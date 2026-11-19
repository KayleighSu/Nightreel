-- Accepted friends can view each other's profiles. Always qualify the
-- profile row ID; unqualified "id" bound to friendships.id instead.
drop policy if exists "self and friends can view profile" on public.profiles;
create policy "self and friends can view profile" on public.profiles
 for select to authenticated
 using (
   profiles.id = (select auth.uid())
   or exists (
     select 1 from public.friendships f
     where f.status='accepted'
       and (
         (f.requester_id=profiles.id and f.recipient_id=(select auth.uid()))
         or
         (f.recipient_id=profiles.id and f.requester_id=(select auth.uid()))
       )
   )
 );

-- The INSERT RLS policy was correct, but authenticated users didn't actually
-- have INSERT privileges. Restrict them to message content and recipients;
-- ID and created_at stay server-generated. The existing RLS ensures sender
-- matches auth.uid() and the relationship is accepted.
grant insert (sender_id,recipient_id,body)
 on public.direct_messages to authenticated;
-- Keep message rows and conversations private.
revoke insert on public.direct_messages from anon;
