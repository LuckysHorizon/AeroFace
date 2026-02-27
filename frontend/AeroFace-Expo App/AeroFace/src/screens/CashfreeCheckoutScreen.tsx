import React, { useState, useRef, useCallback } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { completePayment, markOrderFailed, PaymentResult } from '../lib/cashfreePayment';

const { width: SCREEN_W } = Dimensions.get('window');

interface CashfreeCheckoutScreenProps {
    orderId: string;
    sessionId: string;
    paymentUrl: string;
    planName: string;
    amount: number;
    currency: string;
    onSuccess: (result: PaymentResult) => void;
    onCancel: () => void;
}

// Build an HTML page that loads Cashfree's JS SDK and triggers checkout
function buildCheckoutHtml(sessionId: string, orderId: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Cashfree Payment</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow-x: hidden; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #F5F7FA;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
            -webkit-text-size-adjust: 100%;
        }
        .loading { text-align: center; color: #4F46E5; }
        .loading .spinner {
            width: 40px; height: 40px;
            border: 4px solid #E8EDF2; border-top: 4px solid #4F46E5;
            border-radius: 50%; animation: spin 1s linear infinite;
            margin: 0 auto 16px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading h3 { font-size: 18px; color: #0B1F33; margin-bottom: 4px; }
        .loading p { color: #6B7280; font-size: 14px; margin-top: 4px; }
        .error { color: #DC2626; text-align: center; padding: 20px; }
        .error h3 { margin-bottom: 8px; }
        .error p { color: #6B7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="loading" id="loadingDiv">
        <div class="spinner"></div>
        <h3>Initializing Payment</h3>
        <p>Please wait while we connect to the payment gateway...</p>
    </div>
    <div class="error" id="errorDiv" style="display:none;">
        <h3>Payment Error</h3>
        <p id="errorMsg"></p>
    </div>

    <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
    <script>
        function showError(msg) {
            document.getElementById('loadingDiv').style.display = 'none';
            document.getElementById('errorDiv').style.display = 'block';
            document.getElementById('errorMsg').textContent = msg;
        }

        function sendMessage(type, data) {
            try {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, ...data }));
            } catch(e) {}
        }

        async function initPayment() {
            try {
                document.getElementById('loadingDiv').querySelector('p').textContent = 'Loading payment options...';
                const cashfree = await Cashfree({ mode: "sandbox" });

                const checkoutOptions = {
                    paymentSessionId: "${sessionId}",
                    redirectTarget: "_self",
                };

                // Tell RN the checkout form is being loaded
                sendMessage('CHECKOUT_STARTED', {});

                cashfree.checkout(checkoutOptions).then(function(result) {
                    if (result.error) {
                        sendMessage('PAYMENT_ERROR', { error: result.error.message || 'Payment failed' });
                    }
                    if (result.redirect) {
                        // SDK is redirecting to payment page — do NOT treat as success
                        // The actual success will be detected when Cashfree redirects to return_url
                        console.log('Cashfree redirecting...');
                    }
                    if (result.paymentDetails) {
                        // Only THIS means actual payment completed
                        sendMessage('PAYMENT_SUCCESS', { orderId: '${orderId}' });
                    }
                }).catch(function(err) {
                    showError(err.message || 'Checkout failed');
                    sendMessage('PAYMENT_ERROR', { error: err.message || 'Checkout failed' });
                });
            } catch (err) {
                showError(err.message || 'Failed to initialize Cashfree SDK');
                sendMessage('PAYMENT_ERROR', { error: err.message || 'Failed to initialize' });
            }
        }

        if (typeof Cashfree !== 'undefined') {
            initPayment();
        } else {
            setTimeout(function() {
                if (typeof Cashfree !== 'undefined') {
                    initPayment();
                } else {
                    showError('Payment SDK failed to load. Please check your internet connection.');
                }
            }, 3000);
        }
    </script>
</body>
</html>`;
}

export default function CashfreeCheckoutScreen({
    orderId,
    sessionId,
    paymentUrl,
    planName,
    amount,
    currency,
    onSuccess,
    onCancel,
}: CashfreeCheckoutScreenProps) {
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const completionTriggered = useRef(false);
    const checkoutStarted = useRef(false);
    const webViewRef = useRef<WebView>(null);

    const formatCurrency = (val: number) =>
        '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });

    // Trigger payment completion (with guard against double-fire)
    const triggerCompletion = useCallback(async () => {
        if (completionTriggered.current || processing) return;
        completionTriggered.current = true;
        setProcessing(true);

        console.log('[CashfreeCheckout] >>> Completing payment for order:', orderId);

        try {
            const result = await completePayment(orderId);
            if (result.success) {
                onSuccess(result);
            } else {
                Alert.alert('Payment Issue', result.error || 'Payment could not be verified.');
                onCancel();
            }
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to verify payment');
            onCancel();
        } finally {
            setProcessing(false);
        }
    }, [orderId, processing]);

    // Handle messages from the WebView (postMessage from JS SDK)
    const handleMessage = async (event: { nativeEvent: { data: string } }) => {
        try {
            const msg = JSON.parse(event.nativeEvent.data);
            console.log('[CashfreeCheckout] Message:', msg.type);

            if (msg.type === 'CHECKOUT_STARTED') {
                // Checkout form is loading — mark so we know user will interact
                checkoutStarted.current = true;
                return;
            }

            if (msg.type === 'PAYMENT_SUCCESS') {
                // ONLY real payment success triggers completion
                triggerCompletion();
                return;
            }

            if (msg.type === 'PAYMENT_ERROR') {
                await markOrderFailed(orderId);
                Alert.alert('Payment Failed', msg.error || 'Your payment was not completed.');
                onCancel();
            }
        } catch {
            // Not JSON — ignore
        }
    };

    // Detect success ONLY from our specific return_url redirect
    // Cashfree redirects to aeroface.app/payment/success after real payment
    const handleNavigationChange = async (navState: WebViewNavigation) => {
        const url = navState.url?.toLowerCase() || '';

        // Only log, don't auto-complete from navigation
        // The actual completion happens from onError when aeroface.app fails to load
        if (url.includes('aeroface.app')) {
            console.log('[CashfreeCheckout] Detected return URL redirect:', url.substring(0, 80));
            triggerCompletion();
            return;
        }

        // Detect explicit failure URLs
        if (
            url.includes('status=failed') ||
            url.includes('status=cancelled')
        ) {
            await markOrderFailed(orderId);
            Alert.alert('Payment Failed', 'Your payment was not completed. Please try again.');
            onCancel();
        }
    };

    // Handle WebView errors — the key completion trigger
    // When Cashfree redirects to aeroface.app (which doesn't exist),
    // the WebView error handler fires with the URL — THIS is our success signal
    const handleWebViewError = (syntheticEvent: any) => {
        const { nativeEvent } = syntheticEvent;
        const url = (nativeEvent.url || '').toLowerCase();
        console.log('[CashfreeCheckout] WebView error:', nativeEvent.description, 'url:', url.substring(0, 100));

        // ONLY treat as success if the URL is our return URL (aeroface.app)
        if (url.includes('aeroface.app')) {
            console.log('[CashfreeCheckout] Return URL redirect detected — payment success');
            triggerCompletion();
            return;
        }

        // All other errors are just logged — DON'T auto-complete
    };

    const handleCancel = () => {
        Alert.alert(
            'Cancel Payment?',
            'Are you sure you want to cancel this payment?',
            [
                { text: 'No, Continue', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        await markOrderFailed(orderId);
                        onCancel();
                    },
                },
            ]
        );
    };

    const checkoutHtml = buildCheckoutHtml(sessionId, orderId);

    return (
        <SafeAreaView style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <Pressable style={s.backBtn} onPress={handleCancel}>
                    <Ionicons name="close" size={24} color="#374151" />
                </Pressable>
                <View style={s.headerCenter}>
                    <Text style={s.headerTitle}>Secure Payment</Text>
                    <Text style={s.headerSubtitle} numberOfLines={1}>
                        {planName} • {formatCurrency(amount)}
                    </Text>
                </View>
                <View style={s.secureIcon}>
                    <Ionicons name="lock-closed" size={16} color="#059669" />
                </View>
            </View>

            {/* Processing overlay */}
            {processing && (
                <View style={s.overlay}>
                    <View style={s.overlayCard}>
                        <ActivityIndicator size="large" color="#4F46E5" />
                        <Text style={s.overlayTitle}>Verifying Payment...</Text>
                        <Text style={s.overlaySubtitle}>
                            Please wait while we confirm your subscription.
                        </Text>
                    </View>
                </View>
            )}

            {/* WebView with Cashfree JS SDK */}
            <WebView
                ref={webViewRef}
                source={{ html: checkoutHtml, baseUrl: 'https://sdk.cashfree.com' }}
                style={s.webview}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onNavigationStateChange={handleNavigationChange}
                onMessage={handleMessage}
                onError={handleWebViewError}
                onHttpError={(e) => {
                    const url = (e.nativeEvent?.url || '').toLowerCase();
                    console.log('[CashfreeCheckout] HTTP error:', e.nativeEvent.statusCode, url.substring(0, 80));
                    // Only trigger on our return URL
                    if (url.includes('aeroface.app')) {
                        triggerCompletion();
                    }
                }}
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="compatibility"
                allowsInlineMediaPlayback
                originWhitelist={['*']}
                scalesPageToFit={Platform.OS === 'android'}
                setSupportMultipleWindows={false}
                startInLoadingState
                renderLoading={() => (
                    <View style={s.loaderWrap}>
                        <ActivityIndicator size="large" color="#4F46E5" />
                        <Text style={s.loaderText}>Loading payment gateway...</Text>
                    </View>
                )}
            />

            {/* Loading bar */}
            {loading && <View style={s.loadingBar} />}
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
    },
    headerCenter: { flex: 1, marginHorizontal: 12 },
    headerTitle: { color: '#0B1F33', fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
    headerSubtitle: { color: '#6B7280', fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', marginTop: 1 },
    secureIcon: {
        width: 32, height: 32, borderRadius: 10,
        backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center',
    },

    webview: { flex: 1, width: SCREEN_W },

    loaderWrap: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF',
    },
    loaderText: { color: '#6B7280', fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', marginTop: 12 },

    loadingBar: {
        position: 'absolute', top: Platform.OS === 'ios' ? 100 : 66,
        left: 0, right: 0, height: 2, backgroundColor: '#4F46E5',
    },

    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999, backgroundColor: 'rgba(255,255,255,0.95)',
        alignItems: 'center', justifyContent: 'center',
    },
    overlayCard: { alignItems: 'center', gap: 16, paddingHorizontal: 40 },
    overlayTitle: { color: '#0B1F33', fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold' },
    overlaySubtitle: { color: '#6B7280', fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', textAlign: 'center' },
});
