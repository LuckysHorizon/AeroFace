import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { registerFace, RegisterResponse } from '../lib/faceApi';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const OVAL_W = SCREEN_W * 0.65;
const OVAL_H = OVAL_W * 1.3;

// ─── Types ───────────────────────────────────────────────────────
type ScreenState = 'permission' | 'camera' | 'capturing' | 'uploading' | 'success' | 'error';

interface Props {
    userId: string;
    loungeId?: string;
    onComplete: () => void;
    onCancel: () => void;
}

// ─── Component ───────────────────────────────────────────────────
export default function FaceRegistrationScreen({ userId, loungeId, onComplete, onCancel }: Props) {
    const [state, setState] = useState<ScreenState>('permission');
    const [errorMsg, setErrorMsg] = useState('');
    const [facing, setFacing] = useState<CameraType>('front');
    const [countdown, setCountdown] = useState(3);
    const cameraRef = useRef<CameraView>(null);
    const [permission, requestPermission] = useCameraPermissions();

    // ── Permission ─────────────────────────────────────────────
    useEffect(() => {
        if (permission?.granted) {
            setState('camera');
        }
    }, [permission]);

    const handlePermission = async () => {
        const result = await requestPermission();
        if (result.granted) {
            setState('camera');
        } else {
            Alert.alert(
                'Camera Required',
                'AeroFace needs camera access to register your face for lounge access.',
                [{ text: 'OK' }],
            );
        }
    };

    // ── Capture Flow ───────────────────────────────────────────
    const startCapture = useCallback(() => {
        setState('capturing');
        setCountdown(3);

        let count = 3;
        const timer = setInterval(() => {
            count -= 1;
            setCountdown(count);
            if (count <= 0) {
                clearInterval(timer);
                captureAndUpload();
            }
        }, 1000);
    }, []);

    const captureAndUpload = async () => {
        try {
            if (!cameraRef.current) {
                throw new Error('Camera not ready');
            }

            // Take photo
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: false,
            });

            if (!photo?.uri) throw new Error('Photo capture failed');

            setState('uploading');

            // Resize & compress to base64
            const manipulated = await manipulateAsync(
                photo.uri,
                [{ resize: { width: 640 } }],
                { compress: 0.8, format: SaveFormat.JPEG, base64: true },
            );

            if (!manipulated.base64) throw new Error('Image processing failed');

            // Send to FastAPI
            const result: RegisterResponse = await registerFace(
                manipulated.base64,
                userId,
                loungeId,
            );

            if (result.success) {
                setState('success');
                // Auto-dismiss after 2.5 seconds
                setTimeout(() => onComplete(), 2500);
            } else {
                throw new Error(result.message || 'Registration failed');
            }
        } catch (err: any) {
            console.error('[FaceRegistration] Error:', err);
            setErrorMsg(err.message || 'Face registration failed');
            setState('error');
        }
    };

    const handleRetry = () => {
        setErrorMsg('');
        setState('camera');
    };

    // ── Permission Screen ──────────────────────────────────────
    if (state === 'permission') {
        return (
            <View style={s.container}>
                <LinearGradient colors={['#0A0E1A', '#111827', '#1E293B']} style={s.gradient}>
                    <View style={s.centerContent}>
                        <View style={s.iconCircle}>
                            <Ionicons name="scan-outline" size={48} color="#60A5FA" />
                        </View>
                        <Text style={s.permTitle}>Face Registration</Text>
                        <Text style={s.permSubtitle}>
                            We need camera access to capture your face for secure lounge verification.
                        </Text>
                        <Pressable style={s.permButton} onPress={handlePermission}>
                            <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
                            <Text style={s.permButtonText}>Enable Camera</Text>
                        </Pressable>
                        <Pressable style={s.skipButton} onPress={onCancel}>
                            <Text style={s.skipButtonText}>Skip for now</Text>
                        </Pressable>
                    </View>
                </LinearGradient>
            </View>
        );
    }

    // ── Success Screen ─────────────────────────────────────────
    if (state === 'success') {
        return (
            <View style={s.container}>
                <LinearGradient colors={['#0A0E1A', '#064E3B', '#0A0E1A']} style={s.gradient}>
                    <View style={s.centerContent}>
                        <View style={[s.iconCircle, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                        </View>
                        <Text style={[s.permTitle, { color: '#10B981' }]}>Face Registered!</Text>
                        <Text style={s.permSubtitle}>
                            Your face has been securely registered. You can now access the lounge using face verification.
                        </Text>
                    </View>
                </LinearGradient>
            </View>
        );
    }

    // ── Error Screen ───────────────────────────────────────────
    if (state === 'error') {
        return (
            <View style={s.container}>
                <LinearGradient colors={['#0A0E1A', '#1E293B', '#0A0E1A']} style={s.gradient}>
                    <View style={s.centerContent}>
                        <View style={[s.iconCircle, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                            <Ionicons name="alert-circle" size={64} color="#EF4444" />
                        </View>
                        <Text style={[s.permTitle, { color: '#EF4444' }]}>Registration Failed</Text>
                        <Text style={s.permSubtitle}>{errorMsg}</Text>
                        <Pressable style={s.permButton} onPress={handleRetry}>
                            <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
                            <Text style={s.permButtonText}>Try Again</Text>
                        </Pressable>
                        <Pressable style={s.skipButton} onPress={onCancel}>
                            <Text style={s.skipButtonText}>Skip for now</Text>
                        </Pressable>
                    </View>
                </LinearGradient>
            </View>
        );
    }

    // ── Camera Screen ──────────────────────────────────────────
    return (
        <View style={s.container}>
            <CameraView
                ref={cameraRef}
                style={s.camera}
                facing={facing}
            >
                {/* Dark overlay with oval cutout */}
                <View style={s.overlay}>
                    {/* Top bar */}
                    <View style={s.topBar}>
                        <Pressable style={s.topBtn} onPress={onCancel}>
                            <Ionicons name="close" size={24} color="#FFFFFF" />
                        </Pressable>
                        <Text style={s.topTitle}>Face Registration</Text>
                        <Pressable
                            style={s.topBtn}
                            onPress={() => setFacing(f => f === 'front' ? 'back' : 'front')}
                        >
                            <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
                        </Pressable>
                    </View>

                    {/* Face guide oval */}
                    <View style={s.ovalContainer}>
                        <View style={[
                            s.oval,
                            state === 'capturing' && s.ovalCapturing,
                            state === 'uploading' && s.ovalUploading,
                        ]}>
                            {state === 'capturing' && (
                                <Text style={s.countdownText}>{countdown}</Text>
                            )}
                            {state === 'uploading' && (
                                <ActivityIndicator size="large" color="#60A5FA" />
                            )}
                        </View>
                    </View>

                    {/* Instructions / Capture Button */}
                    <View style={s.bottomBar}>
                        {state === 'uploading' ? (
                            <View style={s.statusPill}>
                                <ActivityIndicator size="small" color="#60A5FA" />
                                <Text style={s.statusText}>Processing your face...</Text>
                            </View>
                        ) : state === 'capturing' ? (
                            <View style={s.statusPill}>
                                <Ionicons name="scan-outline" size={18} color="#FBBF24" />
                                <Text style={[s.statusText, { color: '#FBBF24' }]}>
                                    Hold still...
                                </Text>
                            </View>
                        ) : (
                            <>
                                <Text style={s.instruction}>
                                    Position your face within the oval{'\n'}and tap the button below
                                </Text>
                                <Pressable style={s.captureBtn} onPress={startCapture}>
                                    <View style={s.captureBtnInner}>
                                        <Ionicons name="scan" size={28} color="#FFFFFF" />
                                    </View>
                                </Pressable>
                                <Text style={s.hint}>
                                    Ensure good lighting • Look straight at the camera
                                </Text>
                            </>
                        )}
                    </View>
                </View>
            </CameraView>
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    gradient: { flex: 1 },
    camera: { flex: 1 },

    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },

    // Top bar
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 48,
        paddingHorizontal: 20,
    },
    topBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center', justifyContent: 'center',
    },
    topTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: 0.5,
    },

    // Face oval
    ovalContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    oval: {
        width: OVAL_W,
        height: OVAL_H,
        borderRadius: OVAL_W / 2,
        borderWidth: 3,
        borderColor: 'rgba(96,165,250,0.6)',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    ovalCapturing: {
        borderColor: '#FBBF24',
        borderStyle: 'solid',
        borderWidth: 4,
    },
    ovalUploading: {
        borderColor: '#60A5FA',
        borderStyle: 'solid',
        borderWidth: 4,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    countdownText: {
        color: '#FBBF24',
        fontSize: 72,
        fontFamily: 'SpaceGrotesk_700Bold',
    },

    // Bottom bar
    bottomBar: {
        alignItems: 'center',
        paddingBottom: Platform.OS === 'ios' ? 50 : 36,
        paddingHorizontal: 24,
        gap: 16,
    },
    instruction: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 15,
        fontFamily: 'SpaceGrotesk_400Regular',
        textAlign: 'center',
        lineHeight: 22,
    },
    captureBtn: {
        width: 80, height: 80, borderRadius: 40,
        borderWidth: 4, borderColor: 'rgba(96,165,250,0.5)',
        alignItems: 'center', justifyContent: 'center',
    },
    captureBtnInner: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: '#3B82F6',
        alignItems: 'center', justifyContent: 'center',
    },
    hint: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 12,
        fontFamily: 'SpaceGrotesk_400Regular',
        textAlign: 'center',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    statusText: {
        color: '#60A5FA',
        fontSize: 15,
        fontFamily: 'SpaceGrotesk_500Medium',
    },

    // Permission / Success / Error screens
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        gap: 16,
    },
    iconCircle: {
        width: 120, height: 120, borderRadius: 60,
        backgroundColor: 'rgba(96,165,250,0.12)',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 8,
    },
    permTitle: {
        color: '#FFFFFF',
        fontSize: 28,
        fontFamily: 'SpaceGrotesk_700Bold',
        textAlign: 'center',
    },
    permSubtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 15,
        fontFamily: 'SpaceGrotesk_400Regular',
        textAlign: 'center',
        lineHeight: 22,
    },
    permButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#3B82F6',
        borderRadius: 16,
        paddingHorizontal: 28,
        paddingVertical: 14,
        marginTop: 12,
    },
    permButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'SpaceGrotesk_700Bold',
    },
    skipButton: {
        paddingVertical: 10,
    },
    skipButtonText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        fontFamily: 'SpaceGrotesk_400Regular',
    },
});
