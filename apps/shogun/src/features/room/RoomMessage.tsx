export const RoomMessage = ({ children }: { children: string }) => (
  <div class="panel">
    <p class="label">{children}</p>
    <a class="startButton linkButton" href="/">
      Back to menu
    </a>
  </div>
);
