import { useState, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Image } from "@tiptap/extension-image";
import { Youtube } from "@tiptap/extension-youtube";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Extension } from "@tiptap/core";

import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered,
  Image as ImageIcon, Youtube as YoutubeIcon, BarChart2,
  Minus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ""),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }) => {
        return chain().setMark("textStyle", { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run();
      },
    };
  },
});

export interface PostEditorProps {
  content: string;
  onChange: (html: string) => void;
  attachments?: any[];
  onAttachmentsChange?: (attachments: any[]) => void;
}

const FONT_SIZES = ["10pt", "12pt", "14pt", "16pt", "18pt", "24pt"];
const COLORS = ["#000000", "#475569", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

export function PostEditor({ content, onChange, attachments = [], onAttachmentsChange }: PostEditorProps) {
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Youtube.configure({
        inline: false,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TextStyle,
      Color,
      FontSize,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    disablePasteRules: ["image"], // base64 auto-paste 막기 위함 (선택)
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl max-w-none focus:outline-none min-h-[300px] p-4",
      },
    },
  });

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("업로드 실패");
      const data = await res.json();
      
      editor?.chain().focus().setImage({ src: data.url }).run();
    } catch (e) {
      console.error(e);
      alert("이미지 업로드에 실패했습니다.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [editor]);

  const addYoutube = useCallback(() => {
    if (youtubeUrl) {
      editor?.chain().focus().setYoutubeVideo({ src: youtubeUrl }).run();
      setYoutubeUrl("");
    }
    setYoutubeOpen(false);
  }, [editor, youtubeUrl]);

  const addPoll = useCallback(() => {
    // 임시로 투표 ID 'legislators:today'를 추가 (실제로는 모달 띄워 선택하거나 생성 가능)
    // attachments 연동
    const newPoll = { type: 'poll', pollId: `legislators:${new Date().toISOString().slice(0, 10)}` };
    if (onAttachmentsChange) {
      onAttachmentsChange([...attachments, newPoll]);
    }
    alert("투표가 하단 첨부 영역에 추가되었습니다.");
  }, [attachments, onAttachmentsChange]);

  if (!editor) return null;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border-b border-slate-200">
        <Select
          onValueChange={(val) => editor.chain().focus().setFontSize(val).run()}
        >
          <SelectTrigger className="h-8 w-[80px] bg-white text-xs font-semibold">
            <SelectValue placeholder="16pt" />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map(size => (
              <SelectItem key={size} value={size}>{size}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-px h-5 bg-slate-300 mx-1"></div>

        <Button
          variant="ghost" size="icon" className={`w-8 h-8 ${editor.isActive("bold") ? "bg-slate-200 text-slate-900" : "text-slate-600"}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost" size="icon" className={`w-8 h-8 ${editor.isActive("italic") ? "bg-slate-200 text-slate-900" : "text-slate-600"}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost" size="icon" className={`w-8 h-8 ${editor.isActive("underline") ? "bg-slate-200 text-slate-900" : "text-slate-600"}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost" size="icon" className={`w-8 h-8 ${editor.isActive("strike") ? "bg-slate-200 text-slate-900" : "text-slate-600"}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="w-4 h-4" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-600">
              <span className="w-4 h-4 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: editor.getAttributes("textStyle").color || "#000" }}></span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="flex gap-1 flex-wrap w-[160px]">
              {COLORS.map(color => (
                <button
                  key={color}
                  className="w-6 h-6 rounded-md border border-slate-200"
                  style={{ backgroundColor: color }}
                  onClick={() => editor.chain().focus().setColor(color).run()}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-5 bg-slate-300 mx-1"></div>

        <Button
          variant="ghost" size="icon" className={`w-8 h-8 ${editor.isActive({ textAlign: "left" }) ? "bg-slate-200 text-slate-900" : "text-slate-600"}`}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost" size="icon" className={`w-8 h-8 ${editor.isActive({ textAlign: "center" }) ? "bg-slate-200 text-slate-900" : "text-slate-600"}`}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost" size="icon" className={`w-8 h-8 ${editor.isActive({ textAlign: "right" }) ? "bg-slate-200 text-slate-900" : "text-slate-600"}`}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="w-4 h-4" />
        </Button>

        <div className="w-px h-5 bg-slate-300 mx-1"></div>

        <Button
          variant="ghost" size="icon" className={`w-8 h-8 ${editor.isActive("bulletList") ? "bg-slate-200 text-slate-900" : "text-slate-600"}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost" size="icon" className={`w-8 h-8 ${editor.isActive("orderedList") ? "bg-slate-200 text-slate-900" : "text-slate-600"}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="w-4 h-4" />
        </Button>

        <div className="w-px h-5 bg-slate-300 mx-1"></div>

        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
        <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-600" onClick={() => fileInputRef.current?.click()}>
          <ImageIcon className="w-4 h-4" />
        </Button>
        
        <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-600" onClick={() => setYoutubeOpen(true)}>
          <YoutubeIcon className="w-4 h-4" />
        </Button>

        <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-600" onClick={addPoll}>
          <BarChart2 className="w-4 h-4 text-emerald-600" />
        </Button>

        <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-600" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="w-4 h-4" />
        </Button>
      </div>

      {/* 에디터 본문 */}
      <EditorContent editor={editor} />

      {/* 유튜브 모달 */}
      <Dialog open={youtubeOpen} onOpenChange={setYoutubeOpen}>
        <DialogContent className="max-w-xs p-4 sm:p-6 bg-white rounded-2xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-bold text-slate-800">유튜브 링크 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input 
              placeholder="https://youtube.com/watch?v=..." 
              value={youtubeUrl} 
              onChange={(e) => setYoutubeUrl(e.target.value)} 
              className="text-sm font-medium"
            />
            <Button onClick={addYoutube} className="w-full h-10 font-bold rounded-xl" disabled={!youtubeUrl}>
              추가하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
