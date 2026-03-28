import {
  Body, Button, Container, Head, Heading,
  Html, Preview, Section, Tailwind, Text, Hr
} from '@react-email/components';
import * as React from 'react';

interface BetaInviteEmailProps {
  testflightLink: string;
  email?: string;
}

export function BetaInviteEmail({ testflightLink, email }: BetaInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You're in — your Pod beta invite is here 🎉</Preview>
      <Tailwind>
        <Body className="bg-[#0A0A0B] font-sans m-0 p-0">
          <Container className="mx-auto my-10 max-w-[480px]">
            <Section className="bg-[#111114] rounded-2xl overflow-hidden border border-[#ffffff12]">

              {/* Orange header */}
              <Section className="bg-[#FF4F00] px-8 py-6">
                <Heading className="text-white text-[28px] font-black m-0 tracking-tight">
                  Pod 🐋
                </Heading>
                <Text className="text-[#ffffff99] text-sm m-0 mt-1">
                  Plan Anything, With Anyone
                </Text>
              </Section>

              {/* Body */}
              <Section className="px-8 py-8">
                <Heading className="text-white text-[22px] font-bold m-0 mb-3">
                  Your beta invite is here 🎉
                </Heading>

                <Text className="text-[#a0a0a8] text-[15px] leading-relaxed m-0 mb-2">
                  Thanks for signing up — you're one of the first people to try Pod.
                  Tap the button below to install via TestFlight. Takes about 30 seconds.
                </Text>

                <Text className="text-[#a0a0a8] text-[15px] leading-relaxed m-0 mb-6">
                  Once you're in, try creating a trip and inviting a friend — that's
                  where it gets fun.
                </Text>

                <Button
                  href={testflightLink}
                  className="bg-[#FF4F00] text-white text-[15px] font-bold px-8 py-4 rounded-xl inline-block no-underline text-center"
                  style={{ backgroundColor: '#FF4F00', color: '#ffffff' }}
                >
                  Join the Beta on TestFlight →
                </Button>

                <Hr className="border-[#ffffff12] my-8" />

                {/* What to expect */}
                <Text className="text-[#f0ede8] text-[13px] font-bold m-0 mb-2">
                  What to expect
                </Text>
                <Text className="text-[#a0a0a8] text-[13px] leading-relaxed m-0 mb-1">
                  🗺️ &nbsp;Live GPS tracking for your whole group
                </Text>
                <Text className="text-[#a0a0a8] text-[13px] leading-relaxed m-0 mb-1">
                  ✅ &nbsp;RSVP, itineraries, and invite codes
                </Text>
                <Text className="text-[#a0a0a8] text-[13px] leading-relaxed m-0 mb-6">
                  🔔 &nbsp;Push notifications when plans change
                </Text>

                <Text className="text-[#a0a0a8] text-[13px] leading-relaxed m-0">
                  Found a bug or have feedback? Just reply to this email — I read
                  every message.
                </Text>
              </Section>

              {/* Footer */}
              <Section className="bg-[#0d0d10] px-8 py-5 rounded-b-2xl">
                <Text className="text-[#555] text-[11px] m-0 leading-relaxed">
                  You're receiving this because you signed up for the Pod beta
                  {email ? ` with ${email}` : ''}.
                </Text>
                <Text className="text-[#333] text-[11px] m-0 mt-2">
                  © 2026 Pod · podplananything.com
                </Text>
              </Section>

            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}