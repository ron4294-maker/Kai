class Orchestrator:
    def __init__(self, memory, tools):
        self.memory = memory
        self.tools = tools

    def run(self, user_input):
        # 1. pull relevant memory
        context = self.memory.retrieve(user_input)

        # 2. build basic plan
        plan = {
            "input": user_input,
            "context": context,
            "step": "decide_next_action"
        }

        # 3. return structured response (placeholder for now)
        return plan
