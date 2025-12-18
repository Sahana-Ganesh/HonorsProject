'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect to upload page
    router.push('/upload');
  }, [router]);

  return (
    <div className="container">
      <div className="main">
        <div className="loading">
          <p>Redirecting to photo analysis...</p>
        </div>
      </div>
    </div>
  );
}