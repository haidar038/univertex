import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ArrowLeft, Shield, Lock, Eye, Database, Users, FileText } from "lucide-react";

export default function PrivacyPolicy() {
    const { resolvedTheme } = useTheme();

    return (
        <div className="min-h-screen bg-background">
            {/* Navbar */}
            <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4">
                    <div className="flex h-16 items-center justify-between">
                        <Link to="/" className="flex items-center gap-3">
                            <img src={resolvedTheme === "dark" ? "/UniVertexWhite.png" : "/UniVertex-Primary.png"} alt="UniVertex" className="h-10 w-auto" />
                            <span className="text-xl font-bold text-foreground">UniVertex</span>
                        </Link>

                        <div className="flex items-center gap-3">
                            <ThemeToggle />
                            <Button asChild variant="ghost" size="sm">
                                <Link to="/login">Masuk</Link>
                            </Button>
                            <Button asChild size="sm">
                                <Link to="/signup">Daftar</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Content */}
            <div className="container mx-auto px-4 py-12">
                <div className="mb-6">
                    <Button asChild variant="ghost" size="sm">
                        <Link to="/" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Kembali ke Beranda
                        </Link>
                    </Button>
                </div>

                <div className="mx-auto max-w-4xl">
                    <div className="mb-8 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                            <Shield className="h-8 w-8 text-primary" />
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight mb-4">Kebijakan Privasi</h1>
                        <p className="text-muted-foreground">Terakhir diperbarui: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                    </div>

                    <div className="space-y-8">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <FileText className="h-5 w-5 text-primary" />
                                    <CardTitle>Pendahuluan</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>
                                    UniVertex ("kami", "kita", atau "milik kami") berkomitmen untuk melindungi privasi Anda. Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, dan melindungi informasi pribadi Anda saat
                                    Anda menggunakan platform e-voting kami.
                                </p>
                                <p>Dengan menggunakan layanan UniVertex, Anda menyetujui pengumpulan dan penggunaan informasi sesuai dengan kebijakan ini.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <Database className="h-5 w-5 text-primary" />
                                    <CardTitle>Informasi yang Kami Kumpulkan</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <h3>1. Informasi Pribadi</h3>
                                <p>Kami mengumpulkan informasi berikut saat Anda mendaftar atau menggunakan layanan kami:</p>
                                <ul>
                                    <li>Nama lengkap</li>
                                    <li>Nomor Induk Mahasiswa (NIM)</li>
                                    <li>Alamat email institusi</li>
                                    <li>Program studi dan fakultas</li>
                                    <li>Informasi kelas</li>
                                </ul>

                                <h3>2. Informasi Penggunaan</h3>
                                <p>Kami secara otomatis mengumpulkan informasi tentang bagaimana Anda menggunakan platform kami:</p>
                                <ul>
                                    <li>Log aktivitas (waktu login, logout)</li>
                                    <li>Riwayat voting (tanpa mengungkapkan pilihan spesifik)</li>
                                    <li>Alamat IP dan informasi perangkat</li>
                                    <li>Browser dan sistem operasi yang digunakan</li>
                                </ul>

                                <h3>3. Data Voting</h3>
                                <p>Untuk menjaga integritas pemilihan:</p>
                                <ul>
                                    <li>Kami mencatat bahwa Anda telah memberikan suara</li>
                                    <li>Pilihan voting Anda dienkripsi dan dipisahkan dari identitas pribadi</li>
                                    <li>Tidak ada satu pihak pun yang dapat menghubungkan suara Anda dengan identitas Anda</li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <Lock className="h-5 w-5 text-primary" />
                                    <CardTitle>Bagaimana Kami Menggunakan Informasi Anda</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>Kami menggunakan informasi yang dikumpulkan untuk:</p>
                                <ul>
                                    <li>Memverifikasi identitas dan kelayakan Anda untuk berpartisipasi dalam pemilihan</li>
                                    <li>Memproses dan menghitung suara secara aman</li>
                                    <li>Mencegah fraud dan memastikan satu orang satu suara</li>
                                    <li>Mengirimkan notifikasi terkait pemilihan aktif</li>
                                    <li>Menganalisis partisipasi dan meningkatkan layanan</li>
                                    <li>Memenuhi kewajiban hukum dan peraturan institusi</li>
                                    <li>Memberikan dukungan teknis dan customer service</li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <Shield className="h-5 w-5 text-primary" />
                                    <CardTitle>Keamanan Data</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>Kami menerapkan langkah-langkah keamanan yang kuat untuk melindungi data Anda:</p>
                                <ul>
                                    <li>
                                        <strong>Enkripsi End-to-End:</strong> Semua data voting dienkripsi dari perangkat Anda hingga server kami
                                    </li>
                                    <li>
                                        <strong>Row Level Security (RLS):</strong> Kontrol akses tingkat database untuk memastikan hanya pengguna yang berwenang yang dapat mengakses data tertentu
                                    </li>
                                    <li>
                                        <strong>Authentication Berlapis:</strong> Sistem autentikasi multi-faktor untuk akun admin
                                    </li>
                                    <li>
                                        <strong>Audit Logs:</strong> Semua aktivitas penting dicatat untuk tujuan audit
                                    </li>
                                    <li>
                                        <strong>Server Aman:</strong> Data disimpan di server yang memenuhi standar keamanan internasional
                                    </li>
                                    <li>
                                        <strong>Regular Security Updates:</strong> Sistem kami diperbarui secara berkala untuk mengatasi kerentanan keamanan
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <Users className="h-5 w-5 text-primary" />
                                    <CardTitle>Pembagian Informasi</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>Kami TIDAK menjual, menyewakan, atau membagikan informasi pribadi Anda kepada pihak ketiga, kecuali:</p>
                                <ul>
                                    <li>
                                        <strong>Dengan Persetujuan Anda:</strong> Ketika Anda memberikan izin eksplisit
                                    </li>
                                    <li>
                                        <strong>Untuk Keperluan Institusi:</strong> Data agregat (tanpa identitas pribadi) dapat dibagikan kepada pihak universitas untuk analisis partisipasi
                                    </li>
                                    <li>
                                        <strong>Kewajiban Hukum:</strong> Jika diwajibkan oleh hukum atau proses hukum yang sah
                                    </li>
                                    <li>
                                        <strong>Penyedia Layanan:</strong> Dengan penyedia layanan cloud dan hosting yang telah menandatangani perjanjian kerahasiaan
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <Eye className="h-5 w-5 text-primary" />
                                    <CardTitle>Hak Anda</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>Anda memiliki hak untuk:</p>
                                <ul>
                                    <li>
                                        <strong>Akses:</strong> Meminta salinan data pribadi yang kami simpan tentang Anda
                                    </li>
                                    <li>
                                        <strong>Koreksi:</strong> Memperbarui atau memperbaiki informasi yang tidak akurat
                                    </li>
                                    <li>
                                        <strong>Penghapusan:</strong> Meminta penghapusan akun dan data pribadi (dengan catatan bahwa data voting yang telah di-cast tidak dapat dihapus untuk menjaga integritas pemilihan)
                                    </li>
                                    <li>
                                        <strong>Portabilitas:</strong> Menerima data Anda dalam format yang dapat dibaca mesin
                                    </li>
                                    <li>
                                        <strong>Keberatan:</strong> Menolak pemrosesan data tertentu dalam kondisi tertentu
                                    </li>
                                </ul>
                                <p>
                                    Untuk menggunakan hak-hak ini, silakan hubungi kami di <a href="mailto:privacy@univertex.com">privacy@univertex.com</a>
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Cookies dan Teknologi Pelacakan</CardTitle>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>Kami menggunakan cookies dan teknologi serupa untuk:</p>
                                <ul>
                                    <li>Menjaga sesi login Anda tetap aktif</li>
                                    <li>Mengingat preferensi Anda (seperti tema gelap/terang)</li>
                                    <li>Menganalisis penggunaan platform untuk peningkatan layanan</li>
                                    <li>Mencegah aktivitas fraudulent</li>
                                </ul>
                                <p>Anda dapat mengatur browser Anda untuk menolak cookies, namun beberapa fitur platform mungkin tidak berfungsi dengan baik.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Retensi Data</CardTitle>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>Kami menyimpan data Anda selama:</p>
                                <ul>
                                    <li>
                                        <strong>Akun Aktif:</strong> Selama akun Anda aktif dan selama Anda masih terdaftar sebagai mahasiswa
                                    </li>
                                    <li>
                                        <strong>Data Voting:</strong> Minimal 5 tahun setelah pemilihan untuk tujuan audit dan verifikasi
                                    </li>
                                    <li>
                                        <strong>Log Keamanan:</strong> 12 bulan untuk keperluan investigasi keamanan
                                    </li>
                                </ul>
                                <p>Setelah periode retensi, data akan dihapus atau dianonimkan secara permanen.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Perubahan Kebijakan Privasi</CardTitle>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Perubahan akan:</p>
                                <ul>
                                    <li>Diberitahukan melalui email dan notifikasi di platform</li>
                                    <li>Ditampilkan dengan tanggal "Terakhir Diperbarui" yang baru</li>
                                    <li>Berlaku efektif 30 hari setelah publikasi</li>
                                </ul>
                                <p>Kami mendorong Anda untuk meninjau kebijakan ini secara berkala untuk tetap mengetahui bagaimana kami melindungi informasi Anda.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Hubungi Kami</CardTitle>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>Jika Anda memiliki pertanyaan tentang Kebijakan Privasi ini atau praktik privasi kami, silakan hubungi:</p>
                                <ul>
                                    <li>
                                        <strong>Email:</strong> <a href="mailto:privacy@univertex.com">privacy@univertex.com</a>
                                    </li>
                                    <li>
                                        <strong>Data Protection Officer:</strong> <a href="mailto:dpo@univertex.com">dpo@univertex.com</a>
                                    </li>
                                    <li>
                                        <strong>Alamat:</strong> Gedung Rektorat, Universitas Indonesia
                                    </li>
                                    <li>
                                        <strong>Telepon:</strong> +62 21 1234 5678
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="mt-12 p-6 bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground text-center">
                            Dengan menggunakan UniVertex, Anda menyatakan bahwa Anda telah membaca, memahami, dan menyetujui Kebijakan Privasi ini.
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="border-t py-8 mt-12">
                <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
                    <p>&copy; {new Date().getFullYear()} UniVertex. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
