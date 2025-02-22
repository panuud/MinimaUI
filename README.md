
# MinimaUI

**🤫 Want to chat with AI without anyone noticing? Try MinimaUI!**  
It looks just like plain text—no fancy UI, no distractions, just you and the AI.  

**MinimaUI** is a **minimalistic Next.js web app** that lets you interact with an AI through a simple text field. It keeps your conversation history, manages sessions with cookies, and even allows you to send images to the AI—all in an ultra-lightweight, no-frills interface. 

![無題の動画](https://github.com/user-attachments/assets/938f7399-0f6f-47ff-8f6b-793c196343a1)

## Features

- Simple and intuitive UI with a single text input field.
- Users can start new conversations (`/new`).
- Ability to switch between conversation history (`/history`).
- User sessions are managed with cookies, and conversation history is separated by each user's cookie.
- Users can send images to the AI using `/image`.
- Uses **LangChain** as the primary API for handling requests.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/)
- [Yarn](https://yarnpkg.com/) or `npm`

### Installation

Clone the repository:

```sh
git clone https://github.com/panuud/MinimaUI.git
cd MinimaUI
```

Install dependencies:

```sh
yarn install
```
or
```sh
npm install
```

### Environment Variables

This project requires five environment variables. Create a `.env.local` file in the root directory and add the following:

```ini
SECRET=your-secret-key
OPENAI_API_KEY=your-openai-api-key
JWT_SECRET=your-jwt-secret
NODE_ENV=development
NEXT_PUBLIC_LIMIT_CONTEXT_WINDOW=your-limit-context-window
```

- **`SECRET`** – A secret key for securing session cookies.
- **`OPENAI_API_KEY`** – API key for interacting with OpenAI models.
- **`JWT_SECRET`** – Secret key for JSON Web Token (JWT) authentication.
- **`NODE_ENV`** – The environment mode; typically `development` or `production`.
- **`NEXT_PUBLIC_LIMIT_CONTEXT_WINDOW`** – Limit for the AI's context window.

### Running the Application

Start the development server:

```sh
yarn dev
```
or
```sh
npm run dev
```

Your application should now be running on `http://localhost:3000`.

## Docker Deployment

To deploy the application using **Docker**, follow these steps:

1. Build the Docker image:

   ```sh
   docker build -t minima-ui .
   ```

2. Run the container:

   ```sh
   docker run -d -p 3000:3000 --env-file .env.local minima-ui
   ```

3. The application should now be accessible on `http://localhost:3000`.

💡 **Note:** Make sure your `.env.local` file is correctly set up before running the container.

## Usage

1. **Send a Request:** Type a message in the text field and press enter to interact with the AI.
2. **Start a New Conversation:** Type `/new` to reset the session and begin a fresh conversation.
3. **View Conversation History:** Type `/history` to switch to a previous conversation.
4. **Send an Image:** Use `/image` to send an image to the AI for processing.
5. **Session Management:** Conversations are stored separately for each user using cookies.

## License

This project is licensed under the [MIT License](LICENSE).
