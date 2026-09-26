<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep boards and chat threads in browser storage with export/import for portability, because this project has no shared cloud backend and the user chose browser storage.
- Use a fixed-coordinate canvas for cards and strokes with zoom applied to the canvas, because pen ink and draggable content must stay aligned.
