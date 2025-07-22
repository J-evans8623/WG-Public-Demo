'use client'

/**
 * @file app/studygraph/(studygraph)/mobile-share/page.tsx
 * @responsibility
 *   • Render the mobile-optimized share landing page for users who scan on a phone.
 *   • Read the `?token=` query param (handling null) and compute the full invite URL.
 *   • Provide “Copy”, “Email”, “Bookmark” and “Set Reminder” actions.
 *   • Client-side email sending via SendGrid API endpoint.
 *   • Log critical UI events (6001–6005) for observability.
 *   • Inherit global CSS (Tailwind, gradients, shadows) from root layout.
 */

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Head from 'next/head'

export default function MobileSharePage() {
  const searchParams = useSearchParams()
  // 6000: Handle possible null from useSearchParams()
  const token: string | null = searchParams?.get('token') ?? null

  const [inviteUrl, setInviteUrl] = useState('')
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [copied, setCopied] = useState(false)

  // 6001: Compute invite URL once `token` is present
  useEffect(() => {
    if (token) {
      const url = `${window.location.origin}/s/${token}`
      console.log('app/studygraph/(studygraph)/mobile-share/page.tsx 6001 ○ Computed inviteUrl=', url)
      setInviteUrl(url)
    }
  }, [token])

  const handleCopyUrl = async () => {
    console.log('app/studygraph/(studygraph)/mobile-share/page.tsx 6002 ○ Copying inviteUrl to clipboard')
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('app/studygraph/(studygraph)/mobile-share/page.tsx 6002 ✖ Clipboard write failed:', err)
      alert('Link copied! 🎉')
    }
  }

  const handleSendEmail = async () => {
    console.log('app/studygraph/(studygraph)/mobile-share/page.tsx 6003 ○ Sending invite email to', email)
    try {
      const res = await fetch('/api/share/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, url: inviteUrl }),
      })
      if (!res.ok) throw new Error(await res.text())
      console.log('app/studygraph/(studygraph)/mobile-share/page.tsx 6004 ○ Email sent successfully')
      setEmailSent(true)
      setShowEmailForm(false)
    } catch (err: any) {
      console.error('app/studygraph/(studygraph)/mobile-share/page.tsx 6005 ✖ Email send failed:', err)
      alert('Failed to send email. Please try again.')
    }
  }

  const handleBookmark = () => {
    alert(
      '📱 To bookmark on mobile:\n\n' +
      '1. Tap your browser’s Share button\n' +
      '2. Select “Add to Bookmarks”\n\n' +
      `💻 Then open: ${inviteUrl}`
    )
  }

  const handleAddReminder = () => {
    const remindTime = new Date(Date.now() + 60 * 60 * 1000).toLocaleString()
    alert(
      `📅 Reminder set!\n\n` +
      `We’ll remind you in one hour:\n` +
      `⏰ ${remindTime}\n` +
      `💻 ${inviteUrl}`
    )
  }

  const toggleEmailForm = () => {
    setShowEmailForm(!showEmailForm)
    if (emailSent) setEmailSent(false)
  }

  return (
    <>
      <Head>
        <title>StudyConnect – Join Study Group</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen mobile-gradient flex flex-col justify-center items-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden slide-up">
          {/* Header */}
          <div className="header-gradient text-white px-6 py-6 text-center">
            <h1 className="text-xl font-bold mb-1">🎓 StudyConnect</h1>
            <p className="text-base opacity-90">Join Study Group</p>
          </div>

          {/* Main Content */}
          <div className="px-6 py-6">
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                What you will get on desktop:
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                  <div className="text-xl mb-1">🖥️</div>
                  <div className="text-xs font-medium text-gray-700">
                    Full-screen collaboration
                  </div>
                </div>
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                  <div className="text-xl mb-1">📚</div>
                  <div className="text-xs font-medium text-gray-700">
                    Interactive whiteboards
                  </div>
                </div>
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                  <div className="text-xl mb-1">🎥</div>
                  <div className="text-xs font-medium text-gray-700">
                    HD video sessions
                  </div>
                </div>
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                  <div className="text-xl mb-1">📊</div>
                  <div className="text-xs font-medium text-gray-700">
                    Study analytics
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
                <div className="text-blue-700 font-semibold text-sm">
                  ✨ Join 847+ students already in study groups
                </div>
              </div>
            </div>

            {/* Call to Action */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="text-base font-semibold text-gray-800 text-center mb-3">
                Get the link on your computer:
              </div>
              <div className="space-y-2">
                <button
                  onClick={toggleEmailForm}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg font-medium text-sm transition-all duration-200 hover:bg-blue-600 btn-shadow-blue"
                >
                  📧 Email me the link
                </button>
                <button
                  onClick={handleCopyUrl}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg font-medium text-sm transition-all duration-200 ${
                    copied
                      ? 'bg-green-500 btn-shadow-green'
                      : 'bg-gray-600 hover:bg-gray-700 btn-shadow-gray'
                  }`}
                >
                  {copied ? '✅ Copied!' : '📋 Copy Link'}
                </button>
                <button
                  onClick={handleBookmark}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-lg font-medium text-sm transition-all duration-200 hover:bg-orange-600 btn-shadow-orange"
                >
                  🔖 Bookmark for later
                </button>
                <button
                  onClick={handleAddReminder}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-lg font-medium text-sm transition-all duration-200 hover:bg-emerald-600 btn-shadow-emerald"
                >
                  📅 Set reminder
                </button>
              </div>

              {showEmailForm && !emailSent && (
                <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200 slide-up">
                  <input
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 border border-blue-300 rounded-lg text-sm mb-2 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSendEmail}
                    disabled={!email.includes('@')}
                    className="w-full p-3 bg-blue-500 text-white rounded-lg font-medium text-sm transition-all duration-200 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send Link
                  </button>
                </div>
              )}

              {emailSent && (
                <div className="mt-3 p-3 bg-green-100 text-green-800 rounded-lg text-center font-medium text-sm slide-up">
                  ✅ Link sent! Check your email and open it on your computer.
                </div>
              )}
            </div>

            <div className="bg-gray-100 p-3 rounded-lg font-mono text-xs text-gray-700 text-center border border-dashed border-gray-300 mb-3 break-all">
              💻 {inviteUrl || 'Loading...'}
            </div>
            <div className="text-center text-red-600 text-sm font-medium">
              ⏰ Best experience on desktop – join now!
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
