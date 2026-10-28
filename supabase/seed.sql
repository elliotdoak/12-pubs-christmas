-- Reference data for the crawl. Times are GMT (UTC+0) on Saturday 28 November 2026.
-- [TK] Fill in lat/lng for every pub before game day; geofenced check-in depends on them.

insert into public.players (id, name, costume, pair_group) values
  ('KY', 'Kyle',   'ecto',       4),
  ('RE', 'Reece',  'tree',       4),
  ('ST', 'Steve',  'stocking',   3),
  ('DE', 'Dean',   'schememaw',  1),
  ('HA', 'Hammy',  'snowman',    2),
  ('GR', 'Gregor', 'boy',        1),
  ('EL', 'Elz',    'goth',       3),
  ('GT', 'Grant',  'mistletoe',  null),
  ('CA', 'Cal',    'chocorange', null),
  ('HI', 'Hicksy', 'pilot',      1);

insert into public.pubs (n, name, arrive_at, leave_at, challenge, forfeit) values
  (1,  'Old College Bar', '2026-11-28 12:30+00', '2026-11-28 12:40+00', 'Last to down a can of beer loses', null),
  (2,  'Press Bar',       '2026-11-28 12:45+00', '2026-11-28 13:30+00', 'Worst dressed / best dressed', null),
  (3,  'Blackfriars',     '2026-11-28 13:40+00', '2026-11-28 14:15+00', 'Handcuffs and blindfolds. Don''t break the cuffs: yours or anyone else''s.', 'One of you wears the hat, one takes their shoes off. Can''t decide? Flip a coin.'),
  (4,  'O''Neills',       '2026-11-28 14:20+00', '2026-11-28 14:55+00', 'Handcuffs and blindfolds, same as Blackfriars. Don''t break the cuffs.', 'One of you wears the hat, one takes their shoes off. Can''t decide? Flip a coin.'),
  (5,  'Vodka Wodka',     '2026-11-28 15:00+00', '2026-11-28 15:15+00', 'Short stop. Send a convoy.', null),
  (6,  'Amsterdam',       '2026-11-28 15:30+00', '2026-11-28 16:15+00', 'Imposters / Chameleon', null),
  (7,  'The Ark',         '2026-11-28 16:30+00', '2026-11-28 17:00+00', 'Sing song', null),
  (8,  'Max''s',          '2026-11-28 17:10+00', '2026-11-28 17:40+00', 'No talking', null),
  (9,  'The Lab',         '2026-11-28 17:45+00', '2026-11-28 18:00+00', 'Shot tray relay race. Send a convoy.', null),
  (10, 'The Raven',       '2026-11-28 18:20+00', '2026-11-28 18:35+00', 'No rule. Quick stop.', null),
  (11, 'Felsons',         '2026-11-28 18:40+00', '2026-11-28 19:40+00', 'Killer', null),
  (12, 'Supercube',       '2026-11-28 19:30+00', '2026-11-28 21:30+00', 'Final stop, 7.30pm to 9.30pm. £136 paid by Hammy.', null);
