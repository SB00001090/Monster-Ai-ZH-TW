import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Camera, Video, CheckCircle, XCircle, Loader } from 'lucide-react';
import { trpc } from '@/lib/trpc';

type VerificationStep = 'intro' | 'captcha' | 'photo' | 'liveness' | 'complete';

export function F2FVerificationPage() {
  const [step, setStep] = useState<VerificationStep>('intro');
  const [verificationId, setVerificationId] = useState<number | null>(null);
  const [captchaChallenge, setCaptchaChallenge] = useState<any>(null);
  const [captchaResponse, setCaptchaResponse] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const verificationStatus = trpc.verification.getStatus.useQuery();
  const initializeF2F = trpc.verification.initializeF2F.useMutation();
  const createCaptcha = trpc.verification.createCaptcha.useMutation();
  const validateCaptcha = trpc.verification.validateCaptcha.useMutation();
  const submitPhotoEnhanced = trpc.verification.submitFacePhotoEnhanced.useMutation();
  const submitLivenessEnhanced = trpc.verification.submitLivenessCheckEnhanced.useMutation();

  // Initialize verification
  const handleStartVerification = async () => {
    setIsLoading(true);
    try {
      const result = await initializeF2F.mutateAsync();
      if (result.success && result.verificationId) {
        setVerificationId(result.verificationId);
        // Create CAPTCHA challenge
        const captcha = await createCaptcha.mutateAsync();
        setCaptchaChallenge(captcha);
        setStep('captcha');
      }
    } catch (error) {
      alert('Failed to start verification');
    } finally {
      setIsLoading(false);
    }
  };

  // Validate CAPTCHA
  const handleValidateCaptcha = async () => {
    if (!captchaChallenge || !captchaResponse) {
      alert('Please enter the CAPTCHA response');
      return;
    }

    setIsLoading(true);
    try {
      const result = await validateCaptcha.mutateAsync({
        challengeId: captchaChallenge.challengeId,
        response: captchaResponse,
      });

      if (result.success) {
        // CAPTCHA validated
        setStep('photo');
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      alert('Failed to validate CAPTCHA');
    } finally {
      setIsLoading(false);
    }
  };

  // Capture photo
  const handleCapturePhoto = async () => {
    if (!cameraRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    context.drawImage(cameraRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    const imageUrl = canvasRef.current.toDataURL('image/jpeg');
    setPhotoUrl(imageUrl);

    // In production, upload to storage and get URL
    // For now, use data URL
    if (verificationId) {
      setIsLoading(true);
      try {
        const result = await submitPhotoEnhanced.mutateAsync({
          verificationId,
          photoUrl: imageUrl,
          photoKey: `f2f-photo-${verificationId}`,
        });

        if (result.success) {
          // Photo verified
          setStep('liveness');
        } else {
          alert(`Error: ${result.message}`);
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Start liveness check
  const handleStartLivenessCheck = async () => {
    if (!cameraRef.current || !canvasRef.current || !photoUrl) return;

    // Simulate recording liveness video
    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    // Record multiple frames to simulate video
    const frames: string[] = [];
    for (let i = 0; i < 5; i++) {
      context.drawImage(cameraRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      frames.push(canvasRef.current.toDataURL('image/jpeg'));
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const videoUrl = frames[frames.length - 1]; // Use last frame as video representation
    setVideoUrl(videoUrl);

    if (verificationId) {
      setIsLoading(true);
      try {
        const result = await submitLivenessEnhanced.mutateAsync({
          verificationId,
          videoUrl,
          videoKey: `f2f-liveness-${verificationId}`,
          facePhotoUrl: photoUrl,
        });

        if (result.success) {
          // Verification completed
          setStep('complete');
          verificationStatus.refetch();
        } else {
          alert(`${result.requiresManualReview ? 'Manual Review Required' : 'Verification Failed'}: ${result.message}`);
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Real-Person Verification (F2F)</CardTitle>
            <CardDescription>
              Verify your identity to unlock advanced features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Verification Status */}
            {verificationStatus.data && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Verification Status:</p>
                <Badge
                  variant={
                    verificationStatus.data.isVerified
                      ? 'default'
                      : 'secondary'
                  }
                >
                  {verificationStatus.data.isVerified
                    ? '✓ Verified'
                    : verificationStatus.data.verification?.verificationStatus || 'Not Started'}
                </Badge>
              </div>
            )}

            {/* Step: Intro */}
            {step === 'intro' && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900 dark:text-blue-100">
                      <p className="font-medium mb-2">Why verify?</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Prevent fraud and unauthorized access</li>
                        <li>Unlock premium features</li>
                        <li>Secure your account</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleStartVerification}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    'Start Verification'
                  )}
                </Button>
              </div>
            )}

            {/* Step: CAPTCHA */}
            {step === 'captcha' && captchaChallenge && (
              <div className="space-y-4">
                <p className="text-sm font-medium">Step 1: Verify you're human</p>

                {captchaChallenge.imageUrl && (
                  <img
                    src={captchaChallenge.imageUrl}
                    alt="CAPTCHA"
                    className="w-full border rounded-lg"
                  />
                )}

                <div>
                  <label className="text-sm font-medium">Enter the text above:</label>
                  <Input
                    value={captchaResponse}
                    onChange={(e) => setCaptchaResponse(e.target.value)}
                    placeholder="Enter CAPTCHA text"
                    className="mt-2"
                  />
                </div>

                <Button
                  onClick={handleValidateCaptcha}
                  disabled={isLoading || !captchaResponse}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    'Continue'
                  )}
                </Button>
              </div>
            )}

            {/* Step: Photo */}
            {step === 'photo' && (
              <div className="space-y-4">
                <p className="text-sm font-medium">Step 2: Capture your face</p>

                <div className="bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
                  <video
                    ref={cameraRef}
                    autoPlay
                    playsInline
                    className="w-full aspect-video object-cover"
                  />
                </div>

                <canvas
                  ref={canvasRef}
                  width={640}
                  height={480}
                  className="hidden"
                />

                {photoUrl && (
                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
                    <img src={photoUrl} alt="Captured" className="w-full" />
                  </div>
                )}

                <Button
                  onClick={handleCapturePhoto}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {photoUrl ? 'Retake Photo' : 'Capture Photo'}
                </Button>

                {photoUrl && (
                  <Button
                    onClick={() => setStep('liveness')}
                    disabled={isLoading}
                    className="w-full"
                    variant="outline"
                  >
                    Continue to Liveness Check
                  </Button>
                )}
              </div>
            )}

            {/* Step: Liveness */}
            {step === 'liveness' && (
              <div className="space-y-4">
                <p className="text-sm font-medium">Step 3: Liveness check</p>

                <div className="bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
                  <video
                    ref={cameraRef}
                    autoPlay
                    playsInline
                    className="w-full aspect-video object-cover"
                  />
                </div>

                <Button
                  onClick={handleStartLivenessCheck}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Video className="h-4 w-4 mr-2" />
                  {isLoading ? 'Recording...' : 'Start Liveness Check'}
                </Button>
              </div>
            )}

            {/* Step: Complete */}
            {step === 'complete' && (
              <div className="space-y-4 text-center">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
                <div>
                  <p className="font-semibold text-lg">Verification Complete!</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your identity has been verified. You now have access to premium features.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
