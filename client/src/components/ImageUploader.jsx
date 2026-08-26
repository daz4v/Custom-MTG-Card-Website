import { useRef, useState } from "react";

export default function ImageUploader({ onImage }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");

  function handleFile(file) {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => onImage(img);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  }

  return (
    <div className="field-block">
      <label className="field-label">Card art</label>
      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {fileName ? (
          <span>{fileName}</span>
        ) : (
          <span>Drop an image here, or click to choose one</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
