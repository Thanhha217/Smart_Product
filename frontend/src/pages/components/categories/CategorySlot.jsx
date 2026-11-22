export default function CategorySlot({src, text, visible=true}) {
  return (
    <div className={"flex flex-col items-center w-20 " + (visible ? "visible" : "invisible")} >
        <img className="object-scale-down aspect-square" src={src} alt={text}/>
        <p>{text}</p>
    </div>
    
  );
}