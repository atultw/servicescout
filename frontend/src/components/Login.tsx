"use client";

import { useState } from "react";
import { IMaskInput } from "react-imask";
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
  const [countryCode] = useState("+1");
    const [otp, setOtp] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [otpSent, setOtpSent] = useState(false);

  const handleRequestOtp = async () => {
    setError(null);
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, "");
    // Ensure 10 digits for US numbers
    if (digits.length !== 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    // Format to E.164: +1XXXXXXXXXX
    const formattedPhone = `+1${digits}`;
    try {
      const appVerifier = window.recaptchaVerifier!;
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
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
    <main className="flex min-h-screen flex-col items-center justify-center p-0 bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <div id="recaptcha-container"></div>
      <div className="w-full max-w-md p-8 space-y-8 bg-white border border-gray-200 rounded-2xl shadow-xl">
        <div className="flex justify-center mb-2">
          <BotIcon className="h-12 w-12 text-blue-500 drop-shadow" />
        </div>
        <h1 className="text-3xl font-extrabold text-center text-gray-800 mb-2 tracking-tight">
          Welcome to ServiceScout
        </h1>
        {error && <p className="text-red-500 text-center text-sm font-medium mb-2">{error}</p>}

        {!otpSent ? (
          <>
            <p className="text-center text-gray-500 mb-4">
              Enter your phone number to sign in or sign up.
            </p>
            <form
              onSubmit={e => { e.preventDefault(); handleRequestOtp(); }}
              className="space-y-0"
            >
              <div className="flex items-center space-x-3 mb-6">
                <select
                  value={countryCode}
                  disabled
                  className="bg-gray-100 text-gray-400 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none cursor-not-allowed"
                  style={{ minWidth: "70px" }}
                >
                  <option value="+1">+1</option>
                </select>
                <IMaskInput
                  mask="(000) 000-0000"
                  value={phoneNumber}
                  onAccept={(value: string) => setPhoneNumber(value)}
                  placeholder="(555) 123-4567"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-lg transition-shadow"
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-white transition-all text-lg"
              >
                Send OTP
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-center text-gray-500 mb-4">
              We've sent an OTP to <span className="font-semibold text-gray-700">{phoneNumber}</span>.
            </p>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="123456"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-lg mb-6"
            />
            <button
              onClick={handleVerifyOtp}
              className="w-full px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-white transition-all text-lg"
            >
              Verify OTP & Sign In
            </button>
          </>
        )}
      </div>
    </main>
  )
}
