-- Correct friend-message authorization by fully qualifying both message endpoints.
-- Avoid SQL name-shadowing such as f.recipient_id = f.recipient_id.
drop policy if exists "friend participants can read messages" on public.direct_messages;
drop policy if exists "friends can send messages" on public.direct_messages;
drop policy if exists "participants read accepted friend messages" on public.direct_messages;
drop policy if exists "accepted friends send messages" on public.direct_messages;
create policy "friend participants can read messages" on public.direct_messages
 for select to authenticated
 using (
  ((select auth.uid()) = direct_messages.sender_id or
   (select auth.uid()) = direct_messages.recipient_id)
  and exists(
   select 1 from public.friendships f
   where f.status='accepted'
     and ((f.requester_id = direct_messages.sender_id and f.recipient_id = direct_messages.recipient_id)
       or (f.recipient_id = direct_messages.sender_id and f.requester_id = direct_messages.recipient_id))
  )
 );
create policy "friends can send messages" on public.direct_messages
 for insert to authenticated
 with check (
  direct_messages.sender_id = (select auth.uid())
  and direct_messages.recipient_id <> (select auth.uid())
  and exists(
   select 1 from public.friendships f
   where f.status='accepted'
     and ((f.requester_id = direct_messages.sender_id and f.recipient_id = direct_messages.recipient_id)
       or (f.recipient_id = direct_messages.sender_id and f.requester_id = direct_messages.recipient_id))
  )
 );
