import "@testing-library/jest-dom";

// jsdom doesn't implement scrollIntoView — silence errors from the chat page's
// auto-scroll effect.
window.HTMLElement.prototype.scrollIntoView = () => {};
