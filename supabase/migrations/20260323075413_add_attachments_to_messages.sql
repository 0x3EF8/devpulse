ALTER TABLE messages
ADD COLUMN attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
-- allow authenticated users to upload
CREATE POLICY "Allow uploads by owner"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner);
