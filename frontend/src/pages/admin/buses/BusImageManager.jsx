import { useRef, useState } from "react";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { Alert, IconButton } from "../../../components/admin-ui/ui";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB per file (backend limit)
const MAX_PER_UPLOAD = 5;          // backend: at most 5 images per request

export const BUS_IMAGE_RULES = "JPG, PNG or WEBP · max 5 MB each · up to 5 at a time";

// Used by BOTH create mode (staged files) and edit mode (server images).
// images: [{ key, url, name, isPrimary }]
export default function BusImageManager({ images, onAdd, onRemove, onSetPrimary, busy, canSetPrimary = true }) {
  const inputRef = useRef(null);
  const [problem, setProblem] = useState("");

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    inputRef.current.value = ""; // allow picking the same file again
    if (!files.length) return;

    if (files.length > MAX_PER_UPLOAD) { setProblem(`You can upload at most ${MAX_PER_UPLOAD} images at a time.`); return; }
    const badType = files.find((f) => !ALLOWED.includes(f.type));
    if (badType) { setProblem(`“${badType.name}” is not a JPG, PNG or WEBP image.`); return; }
    const tooBig = files.find((f) => f.size > MAX_SIZE);
    if (tooBig) { setProblem(`“${tooBig.name}” is larger than 5 MB.`); return; }

    setProblem("");
    onAdd(files);
  };

  return (
    <div>
      {problem && <Alert>{problem}</Alert>}

      <div className="bp-images">
        {images.map((img) => (
          <div className={`bp-image-tile ${img.isPrimary ? "primary" : ""}`} key={img.key}>
            <img src={img.url} alt={img.name || "Bus"} />
            {img.isPrimary && <span className="bp-primary-tag">Main</span>}
            <div className="bp-image-tools">
              {canSetPrimary && !img.isPrimary && onSetPrimary && (
                <IconButton icon={Star} label="Set as main image" disabled={busy} onClick={() => onSetPrimary(img)} />
              )}
              <IconButton icon={Trash2} label="Remove image" danger disabled={busy} onClick={() => onRemove(img)} />
            </div>
          </div>
        ))}

        <button type="button" className="bp-image-add" onClick={() => inputRef.current.click()} disabled={busy}>
          <ImagePlus size={22} />
          <span>Add images</span>
        </button>
      </div>

      <input ref={inputRef} type="file" accept={ALLOWED.join(",")} multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      <div className="bp-hint">{BUS_IMAGE_RULES}</div>
    </div>
  );
}
