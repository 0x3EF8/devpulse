-- Add a global conversation
INSERT INTO conversations (id, type) VALUES ('00000000-0000-0000-0000-000000000001', 'global');
INSERT INTO conversation_participants (conversation_id, user_id, email)
SELECT '00000000-0000-0000-0000-000000000001', id, email
FROM auth.users;
