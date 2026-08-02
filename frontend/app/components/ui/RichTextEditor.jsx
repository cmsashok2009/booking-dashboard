"use client";

import { useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Link2, List, ListOrdered, Redo2, Undo2, Unlink } from "lucide-react";
import Button from "./Button";
import TextInput from "./TextInput";

function ToolbarButton({ active = false, disabled = false, label, onClick, children }) {
  return (
    <button
      className={`rich-text-toolbar-button${active ? " active" : ""}`}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function validLink(value) {
  return value === "{{activation_link}}" || /^(https?:\/\/|mailto:)/i.test(value);
}

export default function RichTextEditor({ id, value, onChange, ariaLabel }) {
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: false,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" }
        }
      })
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-label": ariaLabel,
        "aria-multiline": "true"
      }
    },
    onUpdate: ({ editor: activeEditor }) => onChange(activeEditor.getHTML())
  });

  function openLinkEditor() {
    if (!editor) return;
    setLinkUrl(editor.getAttributes("link").href || "{{activation_link}}");
    setLinkError("");
    setLinkEditorOpen(true);
  }

  function applyLink(event) {
    event.preventDefault();
    const nextUrl = linkUrl.trim();
    if (!nextUrl) {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkEditorOpen(false);
      return;
    }
    if (!validLink(nextUrl)) {
      setLinkError("Use an HTTPS, HTTP, mailto, or {{activation_link}} address.");
      return;
    }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: nextUrl }).run();
    setLinkEditorOpen(false);
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" role="toolbar" aria-label="HTML message formatting">
        <ToolbarButton
          label="Bold"
          active={editor?.isActive("bold")}
          disabled={!editor?.can().chain().focus().toggleBold().run()}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor?.isActive("italic")}
          disabled={!editor?.can().chain().focus().toggleItalic().run()}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic aria-hidden="true" />
        </ToolbarButton>
        <span className="rich-text-toolbar-separator" aria-hidden="true" />
        <ToolbarButton
          label="Bullet list"
          active={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered aria-hidden="true" />
        </ToolbarButton>
        <span className="rich-text-toolbar-separator" aria-hidden="true" />
        <ToolbarButton label="Add or edit link" active={editor?.isActive("link")} onClick={openLinkEditor}>
          <Link2 aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Remove link"
          disabled={!editor?.isActive("link")}
          onClick={() => editor?.chain().focus().unsetLink().run()}
        >
          <Unlink aria-hidden="true" />
        </ToolbarButton>
        <span className="rich-text-toolbar-spacer" />
        <ToolbarButton
          label="Undo"
          disabled={!editor?.can().chain().focus().undo().run()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={!editor?.can().chain().focus().redo().run()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 aria-hidden="true" />
        </ToolbarButton>
      </div>
      {linkEditorOpen ? (
        <form className="rich-text-link-editor" onSubmit={applyLink}>
          <div>
            <label htmlFor={`${id}-link`}>Link address</label>
            <TextInput
              id={`${id}-link`}
              value={linkUrl}
              onChange={(event) => {
                setLinkUrl(event.target.value);
                setLinkError("");
              }}
              autoFocus
            />
            {linkError ? <span className="field-error">{linkError}</span> : null}
          </div>
          <Button type="submit" size="sm">
            Apply
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setLinkEditorOpen(false)}>
            Cancel
          </Button>
        </form>
      ) : null}
      <EditorContent editor={editor} className="rich-text-editor-content" />
    </div>
  );
}
