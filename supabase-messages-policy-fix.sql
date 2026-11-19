-- Remove obsolete policies that could authorize messaging with non-friends.
-- Keep only the newly verified reciprocal accepted-friend policies.
drop policy if exists "accepted friends send messages" on public.direct_messages;
drop policy if exists "participants read accepted friend messages" on public.direct_messages;