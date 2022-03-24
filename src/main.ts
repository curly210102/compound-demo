import main from "./benqi/index";
import "./style.css";

const btn = document.querySelector<HTMLDivElement>("button")!;

btn.addEventListener("click", main);
