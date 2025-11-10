"use client";

import { useState } from "react";
import { signInWithPhoneNumber, RecaptchaVerifier, ConfirmationResult } from "firebase/auth";
import { auth } from "../app/firebase";
import { BotIcon } from "./Icons";

declare global {
    interface Window {
      recaptchaVerifier?: RecaptchaVerifier;
      confirmationResult?: ConfirmationResult;
    }
  }

export default function Login() {
    const [phoneNumber, setPhoneNumber] = useState("");
    const [otp, setOtp] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [otpSent, setOtpSent] = useState(false);

    const handleRequestOtp = async () => {
        setError(null);
        if (!phoneNumber.trim()) {
          setError("Please enter a valid phone number.");
          return;
        }
        try {
          const appVerifier = window.recaptchaVerifier!;
          const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
          window.confirmationResult = confirmationResult;
          setOtpSent(true);
          setError(null);
        } catch (error: any) {
          console.error("Error sending OTP:", error);
          setError(`Failed to send OTP: ${error.message}`);
        }
      };
    
      const handleVerifyOtp = async () => {
        setError(null);
        if (!otp.trim()) {
          setError("Please enter the OTP.");
          return;
        }
        try {
          const result = await window.confirmationResult?.confirm(otp);
          if (!result?.user) {
            throw new Error("Failed to verify OTP.");
          }
        } catch (error: any) {
          console.error("Error verifying OTP:", error);
          setError(`Failed to verify OTP: ${error.message}`);
        }
      };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
            <div id="recaptcha-container"></div>
            <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-md">
                <div className="flex justify-center">
                    <BotIcon className="h-10 w-10 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-center text-card-foreground">
                    Welcome Back
                </h1>
                {error && <p className="text-destructive text-center text-sm">{error}</p>}

                {!otpSent ? (
                    <>
                        <p className="text-center text-muted-foreground">
                            Enter your phone number to sign in.
                        </p>
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="+1 555 123 4567"
                            className="w-full px-4 py-2 bg-input border-none rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                            onClick={handleRequestOtp}
                            className="w-full px-4 py-2 font-semibold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                        >
                            Send OTP
                        </button>
                    </>
                ) : (
                    <>
                        <p className="text-center text-muted-foreground">
                            We've sent an OTP to {phoneNumber}.
                        </p>
                        <input
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="123456"
                            className="w-full px-4 py-2 bg-input border-none rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                            onClick={handleVerifyOtp}
                            className="w-full px-4 py-2 font-semibold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                        >
                            Verify OTP & Sign In
                        </button>
                    </>
                )}
            </div>
        </main>
    )
}
