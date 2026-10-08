'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const usuario = localStorage.getItem('usuario');
    if (usuario) {
      router.push('/chat');
    } else {
      router.push('/login');
    }
  }, [router]);

  return null;
}