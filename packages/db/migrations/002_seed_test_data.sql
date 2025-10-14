-- テストデータの挿入

-- メディアデータ
INSERT INTO public.media (id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111', 'メディアA', 'media-a'),
  ('22222222-2222-2222-2222-222222222222', 'メディアB', 'media-b'),
  ('33333333-3333-3333-3333-333333333333', 'メディアC', 'media-c')
ON CONFLICT (slug) DO NOTHING;

-- 勘定科目の大項目（全メディア共通）
-- メディアA用
INSERT INTO public.account_items (id, name, parent_id, media_id, display_order) VALUES
  ('sales-a', '売上', NULL, '11111111-1111-1111-1111-111111111111', 1),
  ('costs-a', '費用', NULL, '11111111-1111-1111-1111-111111111111', 4)
ON CONFLICT DO NOTHING;

-- メディアB用
INSERT INTO public.account_items (id, name, parent_id, media_id, display_order) VALUES
  ('sales-b', '売上', NULL, '22222222-2222-2222-2222-222222222222', 1),
  ('costs-b', '費用', NULL, '22222222-2222-2222-2222-222222222222', 4)
ON CONFLICT DO NOTHING;

-- メディアC用
INSERT INTO public.account_items (id, name, parent_id, media_id, display_order) VALUES
  ('sales-c', '売上', NULL, '33333333-3333-3333-3333-333333333333', 1),
  ('costs-c', '費用', NULL, '33333333-3333-3333-3333-333333333333', 4)
ON CONFLICT DO NOTHING;
