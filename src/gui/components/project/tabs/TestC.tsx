import React from 'react';


export default function TestC(props:any){
	console.log(props.uiSpec['views']['start-view'])
	// console.log(props.uiSpec)
	
	return (
		<p>
		  {props.uiSpec['views']['start-view']['fields'][0]} NEw
		</p>
		);
}

