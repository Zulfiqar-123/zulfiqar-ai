
const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const messages = document.querySelector("#messages");
const sendButton = document.querySelector("#send-button");

let activeRecorder = null;

// AI voice reply
function speakText(text) {
  if (!("speechSynthesis" in window)) {
    alert("Your browser does not support voice reply.");
    return;
  }

  window.speechSynthesis.cancel();

  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = /[\u0600-\u06FF]/.test(text) ? "ur-PK" : "en-US";
  speech.rate = 0.95;
  speech.pitch = 1;

  const voices = window.speechSynthesis.getVoices();

  const selectedVoice = voices.find(voice =>
    voice.lang.toLowerCase().startsWith(
      speech.lang.startsWith("ur") ? "ur" : "en"
    )
  );

  if (selectedVoice) speech.voice = selectedVoice;

  window.speechSynthesis.speak(speech);
}

// English voice input using Groq Whisper
async function startVoiceInput() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Microphone recording is not supported in this browser.");
    return;
  }

  if (!window.MediaRecorder) {
    alert("Your browser does not support audio recording.");
    return;
  }

  let stream;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    const audioChunks = [];

    activeRecorder = recorder;

    recorder.ondataavailable = event => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    recorder.onstop = async () => {
      micButton.disabled = true;
      micButton.textContent = "⏳ Converting English...";

      try {
        const audioBlob = new Blob(audioChunks, {
          type: recorder.mimeType
        });

        const audioFile = new File(
          [audioBlob],
          "voice.webm",
          { type: audioBlob.type }
        );

        const formData = new FormData();
        formData.append("audio", audioFile);

        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Voice transcription failed.");
        }

        if (!data.text || !data.text.trim()) {
          throw new Error("No speech detected. Please try again.");
        }

        input.value = data.text.trim();
        input.focus();

      } catch (error) {
        alert(error.message || "Unable to convert voice to text.");
      } finally {
        stream.getTracks().forEach(track => track.stop());
        activeRecorder = null;
        micButton.disabled = false;
        micButton.textContent = "🎤 Speak English";
      }
    };

    recorder.onerror = () => {
      stream.getTracks().forEach(track => track.stop());
      activeRecorder = null;
      micButton.disabled = false;
      micButton.textContent = "🎤 Speak English";

      alert("Audio recording failed. Please try again.");
    };

    recorder.start();

    micButton.textContent = "⏹ Stop Recording";

  } catch (error) {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    activeRecorder = null;
    micButton.disabled = false;
    micButton.textContent = "🎤 Speak English";

    alert("Microphone access failed: " + error.message);
  }
}

// Microphone button
const micButton = document.createElement("button");
micButton.type = "button";
micButton.textContent = "🎤 Speak English";

micButton.addEventListener("click", () => {
  if (activeRecorder && activeRecorder.state === "recording") {
    activeRecorder.stop();
  } else if (!activeRecorder && !micButton.disabled) {
    startVoiceInput();
  }
});

form.appendChild(micButton);

// Add messages
function addMessage(text, role) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  article.appendChild(bubble);

  if (role === "assistant") {
    const voiceButton = document.createElement("button");
    voiceButton.type = "button";
    voiceButton.textContent = "🔊 Listen";

    voiceButton.addEventListener("click", () => speakText(text));

    article.appendChild(voiceButton);
  }

  messages.appendChild(article);
  messages.scrollTop = messages.scrollHeight;
}

// Send message
form.addEventListener("submit", async event => {
  event.preventDefault();

  const message = input.value.trim();

  if (!message || sendButton.disabled) return;

  addMessage(message, "user");
  input.value = "";

  sendButton.disabled = true;
  sendButton.textContent = "Thinking...";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    addMessage(data.reply, "assistant");
    speakText(data.reply);

  } catch (error) {
    addMessage(
      error.message || "Unable to connect. Please try again.",
      "assistant"
    );
  } finally {
    sendButton.disabled = false;
    sendButton.innerHTML = 'Send <span aria-hidden="true">↗</span>';
    input.focus();
  }
});

// Enter to send
input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
