import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Camera, Video, CheckCircle, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

type VerificationStep = 'intro' | 'captcha' | 'photo' | 'liveness' | 'complete';

export function F2FVerificationPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<VerificationStep>('intro');
  const [verificationId, setVerificationId] = useState<number | null>(null);
  const [captchaChallenge, setCaptchaChallenge] = useState<any>(null);
  const [captchaResponse, setCaptchaResponse] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const verificationStatus = trpc.verification.getStatus.useQuery();
  const initializeF2F = trpc.verification.initializeF2F.useMutation();
  const createCaptcha = trpc.verification.createCaptcha.useMutation();
  const validateCaptcha = trpc.verification.validateCaptcha.useMutation();
  const submitPhotoEnhanced = trpc.verification.submitFacePhotoEnhanced.useMutation();
  const submitLivenessEnhanced = trpc.verification.submitLivenessCheckEnhanced.useMutation();

  const handleStartVerification = async () => {
    setIsLoading(true);
    try {
      const result = await initializeF2F.mutateAsync();
      if (result.success && result.verificationId) {
        setVerificationId(result.verificationId);
        const captcha = await createCaptcha.mutateAsync();
        setCaptchaChallenge(captcha);
        setStep('captcha');
      }
    } catch {
      toast.error(t('verification.startFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateCaptcha = async () => {
    if (!captchaChallenge || !captchaResponse) {
      toast.error(t('verification.captcha.empty'));
      return;
    }

    setIsLoading(true);
    try {
      const result = await validateCaptcha.mutateAsync({
        challengeId: captchaChallenge.challengeId,
        response: captchaResponse,
      });

      if (result.success) {
        setStep('photo');
      } else {
        toast.error(result.message || t('verification.validateFailed'));
      }
    } catch {
      toast.error(t('verification.captcha.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCapturePhoto = async () => {
    if (!cameraRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    context.drawImage(cameraRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    const imageUrl = canvasRef.current.toDataURL('image/jpeg');
    setPhotoUrl(imageUrl);

    if (verificationId) {
      setIsLoading(true);
      try {
        const result = await submitPhotoEnhanced.mutateAsync({
          verificationId,
          photoUrl: imageUrl,
          photoKey: `f2f-photo-${verificationId}`,
        });

        if (result.success) {
          setStep('liveness');
        } else {
          toast.error(result.message || t('verification.photo.failed'));
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleStartLivenessCheck = async () => {
    if (!cameraRef.current || !canvasRef.current || !photoUrl) return;

    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    for (let i = 0; i < 5; i++) {
      context.drawImage(cameraRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (verificationId) {
      setIsLoading(true);
      try {
        const result = await submitLivenessEnhanced.mutateAsync({
          verificationId,
          videoUrl: canvasRef.current.toDataURL('image/jpeg'),
          videoKey: `f2f-liveness-${verificationId}`,
          facePhotoUrl: photoUrl,
        });

        if (result.success) {
          setStep('complete');
          verificationStatus.refetch();
        } else {
          const prefix = result.requiresManualReview
            ? t('verification.liveness.manualReview')
            : t('verification.liveness.failed');
          toast.error(`${prefix}: ${result.message}`);
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
            <CardTitle>{t('verification.title')}</CardTitle>
            <CardDescription>{t('verification.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {verificationStatus.data && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('verification.statusLabel')}</p>
                <Badge
                  variant={verificationStatus.data.isVerified ? 'default' : 'secondary'}
                >
                  {verificationStatus.data.isVerified
                    ? `✓ ${t('verification.verified')}`
                    : verificationStatus.data.verification?.verificationStatus || t('verification.notStarted')}
                </Badge>
              </div>
            )}

            {step === 'intro' && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900 dark:text-blue-100">
                      <p className="font-medium mb-2">{t('verification.whyVerify')}</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>{t('verification.whyList.fraud')}</li>
                        <li>{t('verification.whyList.premium')}</li>
                        <li>{t('verification.whyList.secure')}</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button onClick={handleStartVerification} disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      {t('verification.starting')}
                    </>
                  ) : (
                    t('verification.startVerification')
                  )}
                </Button>
              </div>
            )}

            {step === 'captcha' && captchaChallenge && (
              <div className="space-y-4">
                <p className="text-sm font-medium">{t('verification.captcha.title')}</p>

                {captchaChallenge.question && (
                  <div className="bg-muted rounded-lg p-4 text-center font-mono text-lg">
                    {captchaChallenge.question}
                  </div>
                )}

                {captchaChallenge.imageUrl && (
                  <img
                    src={captchaChallenge.imageUrl}
                    alt="CAPTCHA"
                    className="w-full border rounded-lg"
                  />
                )}

                <div>
                  <label className="text-sm font-medium">{t('verification.captcha.label')}</label>
                  <Input
                    value={captchaResponse}
                    onChange={(e) => setCaptchaResponse(e.target.value)}
                    placeholder={t('verification.captcha.placeholder')}
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
                      {t('verification.captcha.validating')}
                    </>
                  ) : (
                    t('verification.captcha.continue')
                  )}
                </Button>
              </div>
            )}

            {step === 'photo' && (
              <div className="space-y-4">
                <p className="text-sm font-medium">{t('verification.photo.title')}</p>

                <div className="bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
                  <video
                    ref={cameraRef}
                    autoPlay
                    playsInline
                    className="w-full aspect-video object-cover"
                  />
                </div>

                <canvas ref={canvasRef} width={640} height={480} className="hidden" />

                {photoUrl && (
                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
                    <img src={photoUrl} alt="Captured" className="w-full" />
                  </div>
                )}

                <Button onClick={handleCapturePhoto} disabled={isLoading} className="w-full">
                  <Camera className="h-4 w-4 mr-2" />
                  {photoUrl ? t('verification.photo.retake') : t('verification.photo.capture')}
                </Button>

                {photoUrl && (
                  <Button
                    onClick={() => setStep('liveness')}
                    disabled={isLoading}
                    className="w-full"
                    variant="outline"
                  >
                    {t('verification.photo.continueLiveness')}
                  </Button>
                )}
              </div>
            )}

            {step === 'liveness' && (
              <div className="space-y-4">
                <p className="text-sm font-medium">{t('verification.liveness.title')}</p>

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
                  {isLoading ? t('verification.recording') : t('verification.liveness.start')}
                </Button>
              </div>
            )}

            {step === 'complete' && (
              <div className="space-y-4 text-center">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
                <div>
                  <p className="font-semibold text-lg">{t('verification.completeTitle')}</p>
                  <p className="text-sm text-muted-foreground mt-2">{t('verification.completeDesc')}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}