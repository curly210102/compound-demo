import main from "./mumbai"
import './style.css'

const btn = document.querySelector<HTMLDivElement>('button')!;

btn.addEventListener("click", main);
