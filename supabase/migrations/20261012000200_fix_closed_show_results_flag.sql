-- P-B data fix: matikan show_results_after_voting untuk semua event closed.
--
-- UI sekarang memaksa closed => false, tapi baris lama (contoh prod 2026-10-12:
-- event closed+voting dengan flag menyala) tetap bocor bila hanya andalkan UI.
-- Guard RPC R1 sudah menolaknya di server; UPDATE ini menutup lubang di data.

UPDATE public.election_events
SET show_results_after_voting = FALSE
WHERE election_type = 'closed'
  AND show_results_after_voting IS DISTINCT FROM FALSE;
