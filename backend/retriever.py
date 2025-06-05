from config import settings
from utils import embed_texts
from weaviate import Client
from openai import OpenAI

client = Client(settings.WEAVIATE_URL)
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)


def answer_questions_with_rag(questions):
    clarifications = []
    answers = {}

    for idx, question in enumerate(questions):
        response = openai_client.embeddings.create(
            model=settings.EMBEDDING_MODEL, input=question
        )
        q_vector = response.data[0].embedding

        result = (
            client.query.get("DocumentChunk", ["text", "source"])
            .with_near_vector({"vector": q_vector})
            .with_limit(3)
            .do()
        )

        context_chunks = [
            item["text"] for item in result["data"]["Get"]["DocumentChunk"]
        ]
        if not context_chunks:
            clarifications.append({"question": question, "index": idx})
            continue

        context_str = "\n\n".join(context_chunks)
        completion = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "Answer RFP questions using the provided context.",
                },
                {
                    "role": "user",
                    "content": f"Question: {question}\n\nContext:\n{context_str}",
                },
            ],
            temperature=0.2,
        )
        answers[question] = completion.choices[0].message.content

    return answers, clarifications
