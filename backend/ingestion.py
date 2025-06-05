import os
import tempfile
from .utils import read_file, chunk_text, embed_texts
from .config import settings
from weaviate import Client


client = Client(settings.WEAVIATE_URL)


def ingest_documents(files):
    all_chunks = []
    for upload in files:
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.write(upload.file.read())
            tmp_path = tmp.name

        content = read_file(tmp_path)
        chunks = chunk_text(content)
        embedded = embed_texts(chunks)

        for i, (text, vector) in enumerate(embedded):
            data_object = {"text": text, "source": upload.filename, "chunk_id": i}
            client.data_object.create(
                data_object=data_object, class_name="DocumentChunk", vector=vector
            )

        os.remove(tmp_path)
        all_chunks.append(len(embedded))
    return all_chunks
