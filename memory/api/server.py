from flask import Flask, request

app = Flask(__name__)

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json

    return {
        "status": "ok",
        "input": data
    }

if __name__ == "__main__":
    app.run(debug=True)
