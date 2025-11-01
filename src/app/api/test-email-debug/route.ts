import { NextResponse } from 'next/server'

export async function GET() {
  const gmailUser = process.env.GMAIL_USER
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD

  const passwordProcessed = gmailAppPassword?.replace(/\s+/g, '')

  return NextResponse.json({
    gmailUser,
    passwordLength: gmailAppPassword?.length,
    passwordProcessedLength: passwordProcessed?.length,
    hasSpaces: gmailAppPassword !== passwordProcessed,
    firstChars: passwordProcessed?.substring(0, 4),
    lastChars: passwordProcessed?.substring(passwordProcessed.length - 4)
  })
}
