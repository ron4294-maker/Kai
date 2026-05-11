class MemoryStore:
    def __init__(self):
        self.data = []

    def save(self, item):
        self.data.append(item)

    def retrieve(self, query):
        # very simple version for now
        return self.data[-5:]
