import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Download, FileText, Trophy, Users, Vote, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

interface EventResultsViewProps {
  eventId: string;
  eventTitle: string;
  eventStatus: string;
}

interface CandidateResult {
  id: string;
  name: string;
  student_id: string;
  votes: number;
  percentage: number;
  photo_url?: string;
}

interface VotingStats {
  totalVotes: number;
  totalEligibleVoters: number;
  participationRate: number;
  winner: CandidateResult | null;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function EventResultsView({ eventId, eventTitle, eventStatus }: EventResultsViewProps) {
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [stats, setStats] = useState<VotingStats>({
    totalVotes: 0,
    totalEligibleVoters: 0,
    participationRate: 0,
    winner: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, [eventId]);

  const fetchResults = async () => {
    try {
      setLoading(true);

      // Fetch candidates with vote counts
      const { data: candidatesData, error: candidatesError } = await supabase
        .from('candidates')
        .select('id, user_id, vision, mission, photo_url, profiles(full_name, student_id)')
        .eq('event_id', eventId);

      if (candidatesError) throw candidatesError;

      // Fetch vote counts for each candidate
      const candidateResults: CandidateResult[] = await Promise.all(
        (candidatesData || []).map(async (candidate) => {
          const { count, error } = await supabase
            .from('votes')
            .select('*', { count: 'exact', head: true })
            .eq('candidate_id', candidate.id)
            .eq('event_id', eventId);

          if (error) console.error('Error counting votes:', error);

          return {
            id: candidate.id,
            name: (candidate.profiles as any).full_name,
            student_id: (candidate.profiles as any).student_id,
            votes: count || 0,
            percentage: 0, // will calculate later
            photo_url: candidate.photo_url,
          };
        })
      );

      // Calculate total votes
      const totalVotes = candidateResults.reduce((sum, c) => sum + c.votes, 0);

      // Calculate percentages
      candidateResults.forEach((candidate) => {
        candidate.percentage = totalVotes > 0 ? (candidate.votes / totalVotes) * 100 : 0;
      });

      // Sort by votes (descending)
      candidateResults.sort((a, b) => b.votes - a.votes);

      // Get total eligible voters (from event_voter_groups)
      const { data: voterGroupsData } = await supabase
        .from('event_voter_groups')
        .select('class_id')
        .eq('event_id', eventId);

      let totalEligibleVoters = 0;
      if (voterGroupsData && voterGroupsData.length > 0) {
        const classIds = voterGroupsData.map((g) => g.class_id);
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .in('class_id', classIds);
        totalEligibleVoters = count || 0;
      }

      const participationRate =
        totalEligibleVoters > 0 ? (totalVotes / totalEligibleVoters) * 100 : 0;

      const winner = candidateResults.length > 0 && totalVotes > 0 ? candidateResults[0] : null;

      setResults(candidateResults);
      setStats({
        totalVotes,
        totalEligibleVoters,
        participationRate,
        winner,
      });
    } catch (error) {
      console.error('Error fetching results:', error);
      toast.error('Gagal memuat hasil pemilihan');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const csvHeader = 'No,Nama Kandidat,NIM,Jumlah Suara,Persentase\n';
    const csvRows = results
      .map((candidate, index) => {
        return `${index + 1},${candidate.name},${candidate.student_id},${candidate.votes},${candidate.percentage.toFixed(2)}%`;
      })
      .join('\n');

    const csvContent = csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hasil_pemilihan_${eventTitle.replace(/\s+/g, '_')}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success('File CSV berhasil diunduh');
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Gagal membuka jendela print. Pastikan popup tidak diblokir.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hasil Pemilihan - ${eventTitle}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }
          h1 {
            color: #333;
            border-bottom: 3px solid #10b981;
            padding-bottom: 10px;
          }
          .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin: 20px 0;
          }
          .stat-card {
            border: 1px solid #e5e7eb;
            padding: 15px;
            border-radius: 8px;
            background: #f9fafb;
          }
          .stat-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 5px;
          }
          .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #111827;
          }
          .winner-card {
            background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
            color: white;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #f3f4f6;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
          }
          @media print {
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <h1>Hasil Pemilihan</h1>
        <h2>${eventTitle}</h2>
        <p><strong>Status:</strong> ${eventStatus === 'closed' ? 'Selesai' : eventStatus === 'active' ? 'Aktif' : 'Draft'}</p>

        <div class="stats">
          <div class="stat-card">
            <div class="stat-label">Total Suara</div>
            <div class="stat-value">${stats.totalVotes}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Pemilih Terdaftar</div>
            <div class="stat-value">${stats.totalEligibleVoters}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Partisipasi</div>
            <div class="stat-value">${stats.participationRate.toFixed(1)}%</div>
          </div>
        </div>

        ${
          stats.winner
            ? `
        <div class="winner-card">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; opacity: 0.9;">🏆 PEMENANG PEMILIHAN</h3>
          <h2 style="margin: 0; font-size: 28px;">${stats.winner.name}</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">${stats.winner.student_id} - ${stats.winner.votes} suara (${stats.winner.percentage.toFixed(1)}%)</p>
        </div>
        `
            : ''
        }

        <h3>Perolehan Suara per Kandidat</h3>
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Kandidat</th>
              <th>NIM</th>
              <th>Jumlah Suara</th>
              <th>Persentase</th>
            </tr>
          </thead>
          <tbody>
            ${results
              .map(
                (candidate, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${candidate.name}</td>
                <td>${candidate.student_id}</td>
                <td>${candidate.votes}</td>
                <td>${candidate.percentage.toFixed(2)}%</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Dokumen ini digenerate oleh UniVertex E-Voting System</p>
          <p>Tanggal: ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Memuat hasil pemilihan...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Alert>
        <Vote className="h-4 w-4" />
        <AlertTitle>Belum Ada Data</AlertTitle>
        <AlertDescription>
          Belum ada kandidat atau belum ada suara yang masuk untuk pemilihan ini.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Hasil Pemilihan</h2>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportToCSV}>
            <FileText className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportToPDF}>
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Suara Masuk</CardTitle>
            <Vote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVotes}</div>
            <p className="text-xs text-muted-foreground">Suara yang tercatat</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pemilih Terdaftar</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEligibleVoters}</div>
            <p className="text-xs text-muted-foreground">Total DPT</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tingkat Partisipasi</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.participationRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalVotes} dari {stats.totalEligibleVoters} pemilih
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Winner Announcement */}
      {stats.winner && stats.totalVotes > 0 && (
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Trophy className="h-12 w-12 text-yellow-500 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-800 mb-1">
                  🎉 PEMENANG PEMILIHAN
                </h3>
                <h2 className="text-2xl font-bold text-yellow-900 mb-2">
                  {stats.winner.name}
                </h2>
                <div className="flex items-center gap-3 text-sm text-yellow-700">
                  <span className="font-medium">{stats.winner.student_id}</span>
                  <Badge className="bg-yellow-500 hover:bg-yellow-600">
                    {stats.winner.votes} suara ({stats.winner.percentage.toFixed(1)}%)
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Perolehan Suara (Bar Chart)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={results}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="votes" fill="#10b981" name="Jumlah Suara" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribusi Suara (Pie Chart)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={results}
                  dataKey="votes"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.name}: ${entry.percentage.toFixed(1)}%`}
                >
                  {results.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detail Perolehan Suara</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="p-4 text-left text-sm font-medium text-foreground">Peringkat</th>
                  <th className="p-4 text-left text-sm font-medium text-foreground">Nama Kandidat</th>
                  <th className="p-4 text-left text-sm font-medium text-foreground">NIM</th>
                  <th className="p-4 text-left text-sm font-medium text-foreground">Jumlah Suara</th>
                  <th className="p-4 text-left text-sm font-medium text-foreground">Persentase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((candidate, index) => (
                  <tr key={candidate.id} className="hover:bg-muted/30">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {index === 0 && stats.totalVotes > 0 ? (
                          <Trophy className="h-5 w-5 text-yellow-500" />
                        ) : (
                          <span className="text-sm font-medium text-muted-foreground">
                            #{index + 1}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-foreground">{candidate.name}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-muted-foreground">{candidate.student_id}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-foreground">{candidate.votes}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[120px]">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${candidate.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-foreground min-w-[50px]">
                          {candidate.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
