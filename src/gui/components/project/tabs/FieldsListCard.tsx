import React from 'react';
import {Grid,CardActionArea,CardActions,CardContent,Typography,Card,Button} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {fields} from '../data/uiFieldsRegistry'

const initialValues = {
	title:'',
}
const useStyles = makeStyles((theme) => ({
	content: {
    minHeight: 100,
    minWidth: 280,
    [theme.breakpoints.down('sm')]:{
      width:'100%',
    }
    },
    inputfieldscard: {
    backgroundColor:'#353b40',
    color:'#fff',
    textAlign:'right',
    [theme.breakpoints.down('sm')]:{
      marginBottom:15,
      marginTop:10,
    }
    },

}));


	console.log(fields)

function FieldCard(props:any){
	const  { className,handelonClick,fields, ...other } = props;
	return (
	<Grid container spacing={2}  >
		{fields.map((field:any,index:any)=>(
			<Grid item key={`${field.name}-${index}`} id={`${field.name}-${index}`} className={className}>
				<Card>
					< CardActionArea onClick={() => handelonClick(field.id)}>
				        <CardContent  >
				        	<Grid container spacing={2} key={`${field.name}-card-${index}`}>
                    			<Grid item sm={2} xs={12}>
				        		{field.icon}
				        		</Grid>
				        		<Grid item sm={10} xs={12} >
						        <Typography variant="body2" component="p">
						         {field.human_readable_name}
						          <br />
						          {field.description}
						        </Typography>
					        	</Grid>
					        </Grid>
					    </CardContent>
					      
				    </ CardActionArea>
				</Card>
			</Grid>       
		))} 
	</Grid>
	);
}

export default function FieldsListCard(props: any) {
	const classes = useStyles();
	return (
		<>
		
					<FieldCard className={classes.content} handelonClick={props.cretenefield}  fields={fields}/> 
				
		</>
    )
}


