(() => {
  const openButton = document.getElementById("open-sapling")

  if (!(openButton instanceof HTMLButtonElement)) return

  openButton.addEventListener("click", () => {
    const url = chrome.runtime.getURL("v2/index.html")
    window.open(url, "_blank", "noopener,noreferrer")
    window.close()
  })
})()

