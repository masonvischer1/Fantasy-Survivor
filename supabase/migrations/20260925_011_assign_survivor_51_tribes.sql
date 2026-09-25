-- Tribe assignments verified 2026-09-25 from:
-- https://survivor.fandom.com/wiki/Survivor_51
-- Jelly = Angelica Loblack; Thien An = An Nguyen in existing records.
create temporary table survivor_51_tribes (name text primary key, tribe text not null);
insert into survivor_51_tribes values
  ('Alexis Levine', 'Savu'),
  ('Ana Sani', 'Savu'),
  ('Carter Krull', 'Savu'),
  ('Cristian Chavez', 'Savu'),
  ('Eric Macksoud', 'Savu'),
  ('Kristin Flickinger', 'Savu'),
  ('Linnea Capobianco', 'Savu'),
  ('Ori Jean-Charles', 'Savu'),
  ('Rob Antonson', 'Savu'),
  ('Sharonda Cox', 'Savu'),
  ('Aaliyah Puglia', 'Toka'),
  ('An Nguyen', 'Toka'),
  ('Angelica Loblack', 'Toka'),
  ('Brady Booker', 'Toka'),
  ('Danny Kilby', 'Toka'),
  ('Devin Way', 'Toka'),
  ('Jenna Doore', 'Toka'),
  ('Lewis Kelly', 'Toka'),
  ('Maggie Nestor', 'Toka'),
  ('Mike Pinsky', 'Toka'),
  ('Patt Cannaday', 'Toka');
do $$
begin
  if (select count(*) from public.season_contestants c join public.seasons s on s.id=c.season_id join survivor_51_tribes t on t.name=btrim(c.name) where s.slug='survivor-51') <> 21 then
    raise exception 'Expected all 21 Survivor 51 castaways to match';
  end if;
end $$;
update public.season_contestants c set tribe=t.tribe
from survivor_51_tribes t, public.seasons s
where c.season_id=s.id and s.slug='survivor-51' and btrim(c.name)=t.name;
drop table survivor_51_tribes;
