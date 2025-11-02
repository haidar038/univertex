import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle, Scale, UserCheck, Ban } from "lucide-react";

export default function TermsOfService() {
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
                            <Scale className="h-8 w-8 text-primary" />
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight mb-4">Syarat & Ketentuan</h1>
                        <p className="text-muted-foreground">Terakhir diperbarui: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                    </div>

                    <div className="space-y-8">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <FileText className="h-5 w-5 text-primary" />
                                    <CardTitle>Penerimaan Syarat</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>
                                    Selamat datang di UniVertex. Dengan mengakses dan menggunakan platform e-voting ini, Anda setuju untuk terikat oleh Syarat dan Ketentuan berikut. Jika Anda tidak setuju dengan syarat ini, mohon untuk tidak
                                    menggunakan layanan kami.
                                </p>
                                <p>Syarat dan Ketentuan ini berlaku untuk semua pengguna platform, termasuk tetapi tidak terbatas pada admin, pemilih (voters), dan kandidat.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <UserCheck className="h-5 w-5 text-primary" />
                                    <CardTitle>Kelayakan Pengguna</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>Untuk menggunakan UniVertex, Anda harus:</p>
                                <ul>
                                    <li>Berusia minimal 17 tahun</li>
                                    <li>Merupakan mahasiswa aktif dari institusi yang terdaftar</li>
                                    <li>Memiliki email institusi yang valid (@ui.ac.id atau sejenisnya)</li>
                                    <li>Memiliki Nomor Induk Mahasiswa (NIM) yang valid</li>
                                    <li>Tidak sedang dalam status sanksi akademik atau administratif yang melarang partisipasi dalam pemilihan</li>
                                </ul>
                                <p>
                                    Kami berhak untuk memverifikasi kelayakan Anda dan menolak atau membatalkan akun jika informasi yang diberikan tidak akurat atau jika Anda tidak memenuhi kriteria kelayakan.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-primary" />
                                    <CardTitle>Akun Pengguna</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <h3>Pendaftaran Akun</h3>
                                <p>Saat membuat akun, Anda setuju untuk:</p>
                                <ul>
                                    <li>Memberikan informasi yang akurat, lengkap, dan terkini</li>
                                    <li>Menjaga kerahasiaan password Anda</li>
                                    <li>Bertanggung jawab atas semua aktivitas yang terjadi di akun Anda</li>
                                    <li>Segera memberitahu kami jika terjadi penggunaan yang tidak sah</li>
                                    <li>Tidak berbagi atau mentransfer akun Anda kepada orang lain</li>
                                </ul>

                                <h3>Keamanan Akun</h3>
                                <p>Anda bertanggung jawab untuk:</p>
                                <ul>
                                    <li>Menggunakan password yang kuat dan unik</li>
                                    <li>Tidak memberitahu password kepada siapa pun</li>
                                    <li>Logout dari akun setelah selesai menggunakan, terutama di komputer publik</li>
                                    <li>Memperbarui informasi akun jika ada perubahan (email, NIM, kelas, dll.)</li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <FileText className="h-5 w-5 text-primary" />
                                    <CardTitle>Penggunaan Platform</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <h3>Penggunaan yang Diizinkan</h3>
                                <p>Anda diizinkan untuk:</p>
                                <ul>
                                    <li>Mendaftar dan login ke platform</li>
                                    <li>Melihat informasi pemilihan yang relevan</li>
                                    <li>Memberikan suara dalam pemilihan yang Anda layak ikuti</li>
                                    <li>Mendaftar sebagai kandidat (jika memenuhi syarat)</li>
                                    <li>Melihat hasil pemilihan sesuai dengan pengaturan visibilitas</li>
                                </ul>

                                <h3>Penggunaan yang Dilarang</h3>
                                <p>Anda TIDAK diizinkan untuk:</p>
                                <ul>
                                    <li>Menggunakan platform untuk tujuan ilegal atau tidak sah</li>
                                    <li>Mencoba mengakses akun orang lain</li>
                                    <li>Memberikan suara lebih dari satu kali dalam pemilihan yang sama</li>
                                    <li>Memanipulasi, mengganggu, atau merusak sistem voting</li>
                                    <li>Menggunakan bot, script, atau automasi apa pun</li>
                                    <li>Menyalahgunakan atau memanfaatkan kerentanan sistem</li>
                                    <li>Melakukan reverse engineering, decompile, atau disassemble platform</li>
                                    <li>Mengunggah virus, malware, atau kode berbahaya lainnya</li>
                                    <li>Mengumpulkan data pengguna lain tanpa izin</li>
                                    <li>Melakukan spam, phishing, atau aktivitas penipuan lainnya</li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-primary" />
                                    <CardTitle>Aturan Pemilihan (Voting)</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <h3>Prinsip Pemilihan</h3>
                                <ul>
                                    <li>
                                        <strong>Satu Orang, Satu Suara:</strong> Setiap pengguna hanya boleh memberikan satu suara per pemilihan
                                    </li>
                                    <li>
                                        <strong>Kerahasiaan:</strong> Pilihan voting Anda bersifat rahasia dan tidak dapat dilihat oleh siapa pun, termasuk admin
                                    </li>
                                    <li>
                                        <strong>Final:</strong> Setelah suara dikonfirmasi, tidak dapat diubah atau dibatalkan
                                    </li>
                                    <li>
                                        <strong>Waktu Pemilihan:</strong> Voting hanya dapat dilakukan selama periode pemilihan aktif
                                    </li>
                                </ul>

                                <h3>Kandidat</h3>
                                <p>Jika Anda mendaftar sebagai kandidat, Anda setuju untuk:</p>
                                <ul>
                                    <li>Memberikan informasi visi dan misi yang akurat dan tidak menyesatkan</li>
                                    <li>Tidak menggunakan kampanye negatif, fitnah, atau konten yang menyinggung</li>
                                    <li>Mematuhi kode etik kandidat yang ditetapkan institusi</li>
                                    <li>Menerima hasil pemilihan dengan sportif</li>
                                    <li>Menunggu persetujuan admin sebelum profil kandidat dipublikasikan</li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <Scale className="h-5 w-5 text-primary" />
                                    <CardTitle>Hak Kekayaan Intelektual</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>Semua konten, fitur, dan fungsionalitas platform UniVertex, termasuk tetapi tidak terbatas pada:</p>
                                <ul>
                                    <li>Desain, tata letak, dan tampilan visual</li>
                                    <li>Teks, grafik, logo, dan ikon</li>
                                    <li>Kode sumber dan kompilasi software</li>
                                    <li>Trademark dan service marks</li>
                                </ul>
                                <p>Adalah milik eksklusif UniVertex dan dilindungi oleh hukum hak cipta, merek dagang, dan hak kekayaan intelektual lainnya.</p>
                                <p>Konten yang Anda unggah (foto kandidat, visi/misi) tetap menjadi milik Anda, namun Anda memberikan kami lisensi non-eksklusif untuk menampilkannya di platform.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <AlertTriangle className="h-5 w-5 text-primary" />
                                    <CardTitle>Penolakan Jaminan</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>Platform UniVertex disediakan "sebagaimana adanya" dan "sebagaimana tersedia" tanpa jaminan apa pun, baik tersurat maupun tersirat.</p>
                                <p>Kami tidak menjamin bahwa:</p>
                                <ul>
                                    <li>Platform akan selalu tersedia, tidak terputus, atau bebas dari kesalahan</li>
                                    <li>Hasil yang diperoleh dari penggunaan platform akan akurat atau dapat diandalkan</li>
                                    <li>Kualitas produk, layanan, atau informasi akan memenuhi harapan Anda</li>
                                    <li>Kesalahan dalam software akan diperbaiki</li>
                                </ul>
                                <p>Namun, kami berkomitmen untuk memberikan layanan terbaik dan akan berusaha memperbaiki masalah yang terjadi sesegera mungkin.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <AlertTriangle className="h-5 w-5 text-primary" />
                                    <CardTitle>Batasan Tanggung Jawab</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>UniVertex dan afiliasinya tidak akan bertanggung jawab atas:</p>
                                <ul>
                                    <li>Kerugian langsung, tidak langsung, insidental, khusus, atau konsekuensial</li>
                                    <li>Kehilangan data atau informasi</li>
                                    <li>Gangguan bisnis atau kehilangan keuntungan</li>
                                    <li>Kerusakan yang timbul dari penggunaan atau ketidakmampuan menggunakan platform</li>
                                    <li>Akses tidak sah ke data transmisi atau data Anda</li>
                                    <li>Kesalahan atau kelalaian dalam konten platform</li>
                                </ul>
                                <p>Batasan ini berlaku bahkan jika kami telah diberitahu tentang kemungkinan kerugian tersebut.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <Ban className="h-5 w-5 text-primary" />
                                    <CardTitle>Penangguhan dan Penghentian</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>Kami berhak untuk menangguhkan atau menghentikan akses Anda ke platform, tanpa pemberitahuan sebelumnya, jika:</p>
                                <ul>
                                    <li>Anda melanggar Syarat dan Ketentuan ini</li>
                                    <li>Kami mencurigai aktivitas penipuan atau ilegal</li>
                                    <li>Anda memberikan informasi palsu atau menyesatkan</li>
                                    <li>Anda tidak lagi memenuhi kriteria kelayakan</li>
                                    <li>Diperlukan untuk pemeliharaan atau peningkatan sistem</li>
                                    <li>Diwajibkan oleh hukum atau peraturan institusi</li>
                                </ul>
                                <p>Anda juga dapat menghentikan akun Anda kapan saja dengan menghubungi kami. Namun, data voting yang telah dicatat tidak dapat dihapus untuk menjaga integritas pemilihan.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Perubahan Syarat dan Ketentuan</CardTitle>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>Kami berhak untuk memodifikasi atau mengganti Syarat dan Ketentuan ini kapan saja. Jika terjadi perubahan material, kami akan:</p>
                                <ul>
                                    <li>Memberikan notifikasi melalui email atau platform</li>
                                    <li>Memposting pemberitahuan di halaman utama</li>
                                    <li>Memperbarui tanggal "Terakhir Diperbarui"</li>
                                </ul>
                                <p>Penggunaan berkelanjutan platform setelah perubahan berlaku efektif merupakan penerimaan Anda terhadap syarat yang direvisi.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Hukum yang Berlaku</CardTitle>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>Syarat dan Ketentuan ini diatur oleh dan ditafsirkan sesuai dengan hukum Republik Indonesia.</p>
                                <p>Setiap sengketa yang timbul dari atau terkait dengan Syarat dan Ketentuan ini akan diselesaikan melalui:</p>
                                <ul>
                                    <li>Negosiasi dan musyawarah terlebih dahulu</li>
                                    <li>Mediasi jika diperlukan</li>
                                    <li>Pengadilan yang berwenang di wilayah Jakarta jika cara-cara di atas tidak berhasil</li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Ketentuan Umum</CardTitle>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <h3>Keseluruhan Perjanjian</h3>
                                <p>Syarat dan Ketentuan ini, bersama dengan Kebijakan Privasi kami, merupakan keseluruhan perjanjian antara Anda dan UniVertex.</p>

                                <h3>Pemisahan</h3>
                                <p>Jika ada ketentuan dalam Syarat dan Ketentuan ini yang dianggap tidak sah atau tidak dapat diberlakukan, ketentuan tersebut akan dipisahkan dan tidak mempengaruhi validitas ketentuan lainnya.</p>

                                <h3>Pengabaian</h3>
                                <p>Kegagalan kami untuk menegakkan hak atau ketentuan apa pun tidak akan dianggap sebagai pengabaian hak atau ketentuan tersebut.</p>

                                <h3>Pengalihan</h3>
                                <p>Anda tidak dapat mengalihkan hak atau kewajiban Anda berdasarkan Syarat dan Ketentuan ini tanpa persetujuan tertulis kami.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Hubungi Kami</CardTitle>
                            </CardHeader>
                            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                                <p>Jika Anda memiliki pertanyaan tentang Syarat dan Ketentuan ini, silakan hubungi:</p>
                                <ul>
                                    <li>
                                        <strong>Email:</strong> <a href="mailto:legal@univertex.com">legal@univertex.com</a>
                                    </li>
                                    <li>
                                        <strong>Support:</strong> <a href="mailto:support@univertex.com">support@univertex.com</a>
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
                            Dengan menggunakan UniVertex, Anda mengakui bahwa Anda telah membaca, memahami, dan menyetujui untuk terikat oleh Syarat dan Ketentuan ini.
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
