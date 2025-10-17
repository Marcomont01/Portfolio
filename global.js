console.log("It's Alive");

function $$(selector, context = documnet){
    return Array.from(context.querySelectorAll(selector));
}