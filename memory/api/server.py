from flask import Flask, request
from core.orchestrator import Orchestrator
from memory.store import MemoryStore

app = Flask(__name__)

memory = MemoryStore()
orchestrator = Orchestrator(memory, tools=None)

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_input = data.get("input", "")

    # run through system
    result = orchestrator.run(user_input)

    # save to memory
    memory.save({"input": user_input, "output": result})

    return result

if __name__ == "__main__":
    app.run(debug=True)
