# Retrieval-Augmented Generation (RAG)

RAG is a technique that combines information retrieval with language model generation.
Instead of relying solely on the model's training data, RAG retrieves relevant documents
from an external knowledge base and injects them into the prompt as context.

## How it works
1. User submits a query
2. The query is embedded into a vector representation
3. Similar vectors are retrieved from a vector store (e.g., FAISS, Pinecone)
4. Retrieved chunks are injected into the LLM prompt as context
5. The LLM generates an answer grounded in the retrieved documents

## Benefits
- Reduces hallucinations by grounding answers in real documents
- Allows knowledge updates without retraining the model
- Enables domain-specific knowledge injection

## Common vector stores
- FAISS (local, fast)
- Pinecone (managed cloud)
- Weaviate (open source)
- Chroma (lightweight, local)
