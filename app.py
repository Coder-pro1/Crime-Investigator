from flask import Flask, render_template, request, jsonify
import os
from dotenv import load_dotenv
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from pinecone import Pinecone

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Get API keys from environment
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Set environment variables
os.environ["PINECONE_API_KEY"] = PINECONE_API_KEY
os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY
os.environ["OPENROUTER_API_KEY"] = OPENROUTER_API_KEY

# Initialize embedding model
def download_embeddings():
    model_name = "sentence-transformers/all-MiniLM-L6-v2"
    embeddings = HuggingFaceEmbeddings(model_name=model_name)
    return embeddings

embedding = download_embeddings()

# Initialize Pinecone
index_name = "crime-investigater1"
pc = Pinecone(api_key=PINECONE_API_KEY)

# Connect to existing Pinecone index
docsearch = PineconeVectorStore(
    index_name=index_name,
    embedding=embedding
)

# Create retriever
retriever = docsearch.as_retriever(search_type="similarity", search_kwargs={"k": 3})

# Initialize LLM
llm = ChatOpenAI(
    model="google/gemma-3-12b-it:free",
    openai_api_key=OPENROUTER_API_KEY,
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0.7,
    max_tokens=1024
)

# Create prompt template
prompt = ChatPromptTemplate.from_template(
    """You are an expert crime investigator assistant. Based on the context provided, answer the question in a simple, professional manner.

Context: {context}

Question: {input}

Instructions:
- Answer in maximum 3 sentences
- Be concise and direct
- Use simple, professional language
- Do not include references or citations
- If the context doesn't contain the answer, respond with "I don't know based on the available information."

Answer:"""
)

# Helper function to format documents
def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

# Build the RAG chain
rag_chain = (
    {
        "context": retriever | format_docs,
        "input": RunnablePassthrough()
    }
    | prompt
    | llm
    | StrOutputParser()
)

# Routes
@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')

@app.route('/favicon.ico')
def favicon():
    """Serve the favicon"""
    from flask import send_from_directory
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.svg', mimetype='image/svg+xml')

@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat requests"""
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        
        if not user_message:
            return jsonify({'error': 'No message provided'}), 400
        
        print(f"\n🔍 Processing query: {user_message}")
        
        # Process through RAG chain
        print("📡 Retrieving context from Pinecone...")
        response = rag_chain.invoke(user_message)
        
        print(f"✅ Response generated successfully")
        
        return jsonify({
            'response': response
        })
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
