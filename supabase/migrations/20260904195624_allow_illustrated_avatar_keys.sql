alter table public.family_members
  drop constraint if exists family_members_avatar_key_check;

alter table public.family_members
  add constraint family_members_avatar_key_check
  check (
    avatar_key in (
      'teal',
      'blue',
      'green',
      'orange',
      'coral',
      'violet',
      'explorer',
      'console',
      'penguin',
      'teal_pet',
      'orange_cat',
      'gray_cat',
      'golden_dog'
    )
  );
