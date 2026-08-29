import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { LandingPage } from '@/components/LandingPage';

export const metadata: Metadata = {
  title: 'Isenta — Isenção de pedágio para frotas públicas, sempre em dia',
  description:
    'A Isenta cadastra, renova e monitora a isenção de pedágio dos veículos oficiais do seu município em todas as concessionárias do Brasil, com TAG inclusa.',
};

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect('/dashboard');
  }

  return <LandingPage />;
}
