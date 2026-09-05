import React, { useState, useEffect } from 'react';
import { FileText, Share2, Download, ArrowLeft, Trophy, Flame, Zap, TrendingUp } from 'lucide-react';
import { BurnReport } from '../types';
import { generateBurnReport, getPeriodLabel, getLevelEmoji, getReportShareText } from '../lib/burnReport';
import { useAuth } from '../lib/auth';
import { shareBurn } from '../lib/share';
import { downloadOgImage } from '../lib/ogGenerator';

interface BurnReportViewProps {
  onBack: () => void;
  onShowToast: (text: string, sub?: string) => void;
}

export function BurnReportView({ onBack, onShowToast }: BurnReportViewProps) {
  const { user, userProfile } = useAuth();
  const [report, setReport] = useState<BurnReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'alltime'>('alltime');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const data = await generateBurnReport(user.id, period);
      setReport(data);
      setLoading(false);
    };
    load();
  }, [user, period]);

  const handleShare = async () => {
    if (!report) return;
    const text = getReportShareText(report);
    await shareBurn({ text, title: `🔥 ${report.username}'s Burn Report` });
    onShowToast('📤 Report Shared!', 'Your burn report has been shared.');
  };

  const handleDownloadCard = async () => {
    if (!report) return;
    setGenerating(true);
    try {
      await downloadOgImage({
        template: 'roast',
        username: report.username,
        text: `Burn Score: ${report.burn_score} | Level: ${report.level} | Rank: #${report.rank} | Roasts: ${report.total_roasts_given} | Upvotes: ${report.total_upvotes_received}`,
        platform: 'BURNBOARD',
        anonId: `🔥 ${getPeriodLabel(report.period)} Report`,
      }, `burnboard-report-${report.username}.png`);
      onShowToast('📥 Report Downloaded!', 'Check your downloads folder.');
    } catch {
      onShowToast('Download failed', 'Please try again.');
    }
    setGenerating(false);
  };

  const periods: Array<{ value: typeof period; label: string }> = [
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'alltime', label: 'All Time' },
  ];

  const stats = report ? [
    { label: 'Burn Score', value: report.burn_score, icon: <Flame className="w-4 h-4 text-[#ff4d00]" />, color: 'text-[#ff4d00]' },
    { label: 'Roasts Given', value: report.total_roasts_given, icon: <Zap className="w-4 h-4 text-amber-500" />, color: 'text-amber-500' },
    { label: 'Upvotes Received', value: report.total_upvotes_received, icon: <TrendingUp className="w-4 h-4 text-green-500" />, color: 'text-green-500' },
    { label: 'Reactions', value: report.total_reactions_received, icon: <span className="text-sm">😂</span>, color: 'text-yellow-400' },
    { label: 'Rank', value: `#${report.rank}`, icon: <Trophy className="w-4 h-4 text-purple-500" />, color: 'text-purple-400' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#ff4d00]" />
          <h1 className="text-lg font-black text-white uppercase font-mono">BURN REPORT</h1>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex items-center gap-2">
        {periods.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              period === p.value
                ? 'bg-[#ff4d00] text-black'
                : 'bg-[#141414] text-zinc-400 border border-[#262626] hover:border-[#3a3a3a]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Report Card */}
      {loading ? (
        <div className="bg-[#111] border border-[#222] rounded-2xl p-6 animate-pulse">
          <div className="h-4 bg-[#222] rounded w-48 mb-4" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-[#222] rounded-xl" />
            ))}
          </div>
        </div>
      ) : !report ? (
        <div className="text-center py-12 bg-[#111] border border-dashed border-[#222] rounded-2xl">
          <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">No data yet. Start roasting to generate your report!</p>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-[#1a0a00] to-[#111] border-2 border-[#ff4d00]/30 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-[#ff4d00]/5 rounded-full blur-3xl" />

          <div className="relative z-10">
            {/* Title */}
            <div className="text-center mb-6">
              <div className="text-xs font-mono text-zinc-500 mb-1">BURN REPORT</div>
              <h2 className="text-2xl font-black text-white font-mono">
                @{report.username}
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                {getPeriodLabel(report.period)} • {getLevelEmoji(report.level)} {report.level}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {stats.map(stat => (
                <div key={stat.label} className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {stat.icon}
                  </div>
                  <div className={`text-xl font-black font-mono ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Top Roast */}
            {report.top_roast && (
              <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 mb-6">
                <div className="text-xs font-mono text-zinc-500 mb-2 flex items-center gap-1">
                  🏆 Top Roast ({report.top_roast.upvotes} upvotes)
                </div>
                <p className="text-sm text-white font-medium leading-relaxed">
                  "{report.top_roast.text}"
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#ff4d00] hover:bg-[#ff6622] text-black font-black text-xs uppercase rounded-xl transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share Report
              </button>
              <button
                onClick={handleDownloadCard}
                disabled={generating}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-zinc-300 font-bold text-xs uppercase rounded-xl transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {generating ? 'Generating...' : 'Download Card'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
