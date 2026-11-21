-- R3: kunci search_path fungsi lama (temuaan advisor function_search_path_mutable).
--
-- Fungsi di bawah berjalan tanpa SET search_path sehingga rentan
-- search_path hijacking bila salah satunya SECURITY DEFINER. Isi body sudah
-- diaudit: semua referensi tabel/fungsi ter-qualified (public.* / auth.*)
-- atau katalog (now()), jadi mengunci path = public tidak mengubah perilaku.
-- Diverifikasi per fungsi 2026-10-16 sebelum apply.

ALTER FUNCTION public.update_candidates_updated_at() SET search_path = public;
ALTER FUNCTION public.notify_candidate_status_change() SET search_path = public;
ALTER FUNCTION public.validate_election_state_transition() SET search_path = public;
ALTER FUNCTION public.audit_log_immutable() SET search_path = public;
ALTER FUNCTION public.tg_enforce_vote_timeline() SET search_path = public;
ALTER FUNCTION public.assert_event_is_votable(UUID) SET search_path = public;
ALTER FUNCTION public.assert_event_is_votable(UUID, UUID) SET search_path = public;
