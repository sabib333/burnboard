'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { track } from '@/lib/analytics';

export default function TodaysSpark() {
  const [spark, setSpark] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasParticipated, setHasParticipated] = useState(false);

  useEffect(() => {
    fetchSpark();
  }, []);

  async function fetchSpark() {
    try {
      const res = await fetch('/api/daily-spark');
      if (res.ok) {
        const data = await res.json();
        setSpark(data.spark);
        setStats(data.stats);
        setHasParticipated(data.has_participated);
        if (data.spark) {
          track('daily_spark_viewed', { spark_id: data.spark.id });
        }
      }
    } catch (err) {
      console.error('Failed to fetch spark:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{
        padding: '20px',
        background: 'linear-gradient(135deg, #f9731610, #ef444410)',
        borderRadius: '16px',
        border: '1px solid #f9731630',
      }} className="animate-pulse">
        <div style={{ height: '24px', background: 'var(--surface)', borderRadius: '4px', width: '60%', marginBottom: '12px' }} />
        <div style={{ height: '16px', background: 'var(--surface)', borderRadius: '4px', width: '80%' }} />
      </div>
    );
  }

  if (!spark) {
    return null;
  }

  return (
    <div style={{
      padding: '20px',
      background: 'linear-gradient(135deg, #f9731610, #ef444410)',
      borderRadius: '16px',
      border: '1px solid #f9731630',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '20px' }}>⚡</span>
        <span style={{
          fontSize: '14px',
          fontWeight: 700,
          color: '#f97316',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Today&apos;s Spark
        </span>
      </div>

      <h3 style={{
        fontSize: '18px',
        fontWeight: 700,
        color: 'var(--text-primary)',
        margin: '0 0 8px 0',
        lineHeight: 1.3,
      }}>
        {spark.title}
      </h3>

      {spark.prompt && (
        <p style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          margin: '0 0 16px 0',
          lineHeight: 1.5,
        }}>
          {spark.prompt}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {hasParticipated ? (
          <span style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: '#22c55e20',
            color: '#22c55e',
            fontSize: '13px',
            fontWeight: 600,
          }}>
            ✓ You participated
          </span>
        ) : (
          <Link
            href={`/create?spark=${spark.id}`}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#f97316',
              color: 'white',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-block',
            }}
            onClick={() => track('daily_spark_participate_clicked', { spark_id: spark.id })}
          >
            Join the Conversation
          </Link>
        )}

        {stats && (
          <span style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}>
            {stats.participation_count} participation{stats.participation_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
