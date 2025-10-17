console.log("It's Alive");

export function $$(selector, context = documnet){
    return Array.from(context.querySelectorAll(selector));
}